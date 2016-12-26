/* @flow */

import { inspect } from 'util';
import rp from 'request-promise';
import {
  apiBaseUrl,
  subreddit,
  username,
  password,
  appId,
  appSecret,
  userAgent,
  useOldModmail,
  submissionMatchRegex,
} from './constants';

import type { Headers, ModmailList } from './types';

type OAuthResponse = {
  access_token: string;
};

/**
 * Gets the OAuth access token using the username, password, app id and secret provided via env vars.
 * @return {Promise<string>}
 */
export async function getAccessToken(): Promise<string> {
  const res: OAuthResponse = await rp({
    uri: 'https://www.reddit.com/api/v1/access_token',
    method: 'POST',
    json: true,
    headers: { 'User-Agent': userAgent },
    form: {
      grant_type: 'password',
      username,
      password,
    },
    auth: {
      user: appId,
      pass: appSecret,
    },
  });

  if (!res || !res.access_token) {
    throw new Error(`No access_token was returned: ${inspect(res)}`);
  }

  return res.access_token;
}

type OldModmailResponse = {
  data: {
    children: Array<{
      kind: string;
      data: {
        body: string;
        author: string;
        new: bool;
        id: string;
      };
    }>;
  };
};

/**
 * Gets the modmail for the subreddit using the old modmail system
 * @param {Headers} headers
 * @return {Promise<ModmailResponse>}
 */
export async function listOldModmail(headers: Headers): Promise<ModmailList> {
  const res: OldModmailResponse = await rp({
    uri: `https://oauth.reddit.com/r/${subreddit}/about/message/moderator?raw_json=1`,
    method: 'GET',
    json: true,
    headers,
    resolveWithFullResponse: true,
  }).then(checkRemainingRateLimit);

  const { children } = res.data;
  return children.map(child => child.data).filter(child =>
    child.new === true && child.author === 'AutoModerator' && child.body.match(/There is a new post/)
  );
}

// type Conversation = {
//   id: string;
//   objIds: Array<{ id: string, key: string }>;
//   lastUserUpdate: string;
//   lastUnread: ?string;
//   participant: {
//     name: string;
//   };
// };
//
// type Message = {
//   bodyMarkdown: string;
// };
//
// type NewModmailResponse = {
//   conversations: { [key: string]: Conversation };
//   messages: { [key: string]: Message };
// };

/**
 * Gets the modmail for the subreddit using the new modmail system
 * @param  {Headers} headers
 * @return {Promise<ModmailResponse>}
 */
export async function listNewModmail(headers: Headers): Promise<ModmailList> {
  // TODO https://www.reddit.com/r/redditdev/comments/5kbs1k/whats_the_best_way_to_determine_if_a_conversation/
}

/**
 * Marks the modmail thread as read for the bot user using the new modmail system
 * @param  {Headers} headers
 * @param  {string}  id      Modmail message ID
 * @return {Promise}
 */
export async function markMessageRead(headers: Headers, id: string): Promise<void> {
  return rp({
    uri: `${apiBaseUrl}/mod/conversations/read?conversationIds=${id}`,
    method: 'POST',
    headers,
  });
}

/**
 * Marks the modmail thread as read for the bot user using the old modmail system
 * @param  {Headers} headers
 * @param  {string}  id      Modmail message ID
 * @return {Promise}
 */
export async function markMessageReadOld(headers: Headers, id: string): Promise<void> {
  return rp({
    uri: 'https://oauth.reddit.com/api/read_message',
    method: 'POST',
    headers,
    form: {
      id: `t4_${id}`,
    },
  });
}

type CommentResponse = {
  json: {
    data: {
      things: Array<{
        kind: string;
        data: {
          name: string;
        }
      }>
    }
  }
}

/**
 * This is used in addTrackbackLinkComment to parse the ID of the submission from the link that's returned from getSubmissionLinkFromModmail
 * @type {RegExp}
 */
const submissionIdRegex = /comments\/(\w+)\//;

/**
 * Adds a comment in the submission with a link back to the modmail thread
 * @param  {Headers} headers
 * @param  {string}  messageId        Modmail message ID
 * @param  {string}  submissionLink   Link to the submission
 * @return {Promise<string>}          The comment ID
 */
export async function addTrackbackLinkComment(headers: Headers, messageId: string, submissionLink: string): Promise<?string> {
  let submissionId = submissionLink.match(submissionIdRegex);

  if (submissionId && submissionId.length > 1) {
    submissionId = submissionId[1];
  } else {
    console.log('Could not find submission ID for link', submissionLink);
    return Promise.resolve();
  }

  const commentLink = useOldModmail ?
    `https://www.reddit.com/message/messages/${messageId}` :
    `https://mod.reddit.com/mail/all/${messageId}`;

  const res: CommentResponse = await rp({
    method: 'POST',
    uri: `${apiBaseUrl}/comment`,
    headers,
    json: true,
    form: {
      thing_id: `t3_${submissionId}`,
      text: `Here's a link to the modmail thread associated with this post:

${commentLink}

----

I'm a bot. If I am malfunctioning please contact /u/vs845.`,
      api_type: 'json',
    },
  });

  return res.json.data.things[0].data.name;
}

/**
 * Removes the comment with the link to the comment thread so that only mods can see the comment
 * @param  {string}  commentId The comment ID returned from addTrackbackLinkComment
 * @return {Promise}
 */
export async function removeTrackbackLinkComment(headers: Headers, commentId: string): Promise<void> {
  return rp({
    method: 'POST',
    uri: `${apiBaseUrl}/remove`,
    headers,
    form: {
      id: commentId,
    },
  });
}

/**
 * Parses out the submission link from the modmail message
 * @param  {string} body  The message body as returned from the modmail request
 * @return {string}       The link to the submission
 */
export function getSubmissionLinkFromMessageBody(body: string): ?string {
  const link = body.match(submissionMatchRegex);

  if (link && link.length > 1) {
    return link[1];
  }

  console.log('Could not find submission link in message', body);
  return null;
}

type RPFullResponse = {
  headers: { [key: string]: string };
  body: { [key: string]: any };
};

/**
 * Check how many requests we still have after each modmail fetch
 * @param  {Object} res Response from request-promise
 * @return {Object}     The body of the response
 */
function checkRemainingRateLimit(res: RPFullResponse): Object|RPFullResponse {
  try {
    const { headers, body } = res;
    console.log('Rate limit remaining:', headers['x-ratelimit-remaining']);
    return body;
  } catch (err) {
    console.error('Could not parse remaining rate limit', inspect(err));
    return res;
  }
}
