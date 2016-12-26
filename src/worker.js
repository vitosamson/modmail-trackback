/* @flow */

import { inspect } from 'util';
import rp from 'request-promise';

type Conversation = {
  id: string;
  objIds: Array<{ id: string, key: string }>;
  lastUnread: ?string;
};

type Message = {
  bodyMarkdown: string;
};

type OAuthResponse = {
  access_token: string;
};

type ModmailResponse = {
  conversations: { [key: string]: Conversation };
  messages: { [key: string]: Message };
};

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

const username = process.env.USER;
const password = process.env.PASS;
const appId = process.env.APP_ID;
const appSecret = process.env.APP_SECRET;
const subreddit = process.env.SUBREDDIT || '';
const useOldModmail = process.env.USE_OLD_MODMAIL === 'true'; // env vars are strings

const apiBaseUrl = 'https://oauth.reddit.com/api';
const headers = {
  Authorization: '',
  'User-Agent': 'modmail-trackback-link',
};

/**
 * Check how many requests we still have after each modmail fetch
 * @param  {Object} res Response from request-promise
 * @return {Object}     The body of the response
 */
function checkRemainingRateLimit(res: Object): Object {
  try {
    const { headers, body } = res;
    console.log(`Rate limit remaining: ${headers['x-ratelimit-remaining']}`);
    return body;
  } catch (err) {
    console.error('Could not parse remaining rate limit', inspect(err));
    return res;
  }
}

/**
 * Gets the OAuth access token using the username, password, app id and secret provided via env vars.
 * Sets the Authorization header after the access token has been successfully retrieved.
 * @return {Promise<string>}
 */
async function getAccessToken(): Promise<string> {
  const res: OAuthResponse = await rp({
    uri: 'https://www.reddit.com/api/v1/access_token',
    method: 'POST',
    json: true,
    headers,
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

  headers.Authorization = `bearer ${res.access_token}`;
  return res.access_token;
}

/**
 * Gets the modmail for the subreddit
 * @return {Promise<ModmailResponse>}
 */
async function getModmail(): Promise<ModmailResponse> {
  if (useOldModmail) return getModmailOld();

  return await rp({
    uri: `${apiBaseUrl}/mod/conversations?entity=${subreddit}`,
    json: true,
    headers,
    resolveWithFullResponse: true,
  }).then(checkRemainingRateLimit);
}

/**
 * Gets the modmail for a subreddit using the old modmail system
 * @return {Promise<ModmailResponse>}
 */
async function getModmailOld(): Promise<ModmailResponse> {
  const res = await rp({
    uri: `https://oauth.reddit.com/r/${subreddit}/about/message/moderator?raw_json=1`,
    method: 'GET',
    json: true,
    headers,
    resolveWithFullResponse: true,
  }).then(checkRemainingRateLimit);

  const { children } = res.data;
  const conversations = {};
  const messages = {};

  children.forEach(({ data: child }) => {
    conversations[child.id] = {
      id: child.id,
      objIds: [{
        id: child.id,
        key: 'messages',
      }],
      lastUnread: child.new ? 'unread' : null,
    };

    messages[child.id] = {
      id: child.id,
      bodyMarkdown: child.body,
    };
  });

  return { conversations, messages };
}

/**
 * Marks the modmail thread as read for the bot user
 * @param  {string}  convoId Modmail conversation ID
 * @return {Promise}
 */
async function markAsRead(convoId: string): Promise<void> {
  if (useOldModmail) return markAsReadOld(convoId);

  return await rp({
    uri: `${apiBaseUrl}/mod/conversations/read?conversationIds=${convoId}`,
    method: 'POST',
    headers,
  });
}

/**
 * Marks the modmail thread as read for subreddits using the old modmail system
 * @param  {string}  convoId Modmail conversation ID
 * @return {Promise}
 */
async function markAsReadOld(convoId: string): Promise<void> {
  return await rp({
    uri: 'https://oauth.reddit.com/api/read_message',
    method: 'POST',
    headers,
    form: {
      id: `t4_${convoId}`,
    },
  });
}

/**
 * Adds a comment in the submission with a link back to the modmail thread
 * @param  {string}  convoId        Modmail conversation ID
 * @param  {string}  submissionLink Link to the submission
 * @return {Promise<string>}        The comment ID
 */
async function addTrackbackLinkComment(convoId: string, submissionLink: string): Promise<string> {
  const submissionId = submissionLink.split('reddit.com/')[1].split('/')[3];

  const res: CommentResponse = await rp({
    method: 'POST',
    uri: `${apiBaseUrl}/comment`,
    headers,
    json: true,
    form: {
      thing_id: `t3_${submissionId}`,
      text: `Modmail thread: https://mod.reddit.com/mail/all/${convoId}`,
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
async function removeTrackbackLinkComment(commentId: string) {
  return await rp({
    method: 'POST',
    uri: `${apiBaseUrl}/remove`,
    headers,
    form: {
      id: commentId,
    },
  });
}

/**
 * Finds any unread modmail threads. When a conversation has been marked as read, its `lastUnread` property will be `null`.
 * @param  {Object} conversations The conversations as returned from getModmail
 * @return {Array<Conversation>}  An array of unread modmail conversations
 */
function filterUnreadConversations(conversations: { [key: string]: Conversation }): Array<Conversation> {
  return Object.keys(conversations).filter(convoId =>
    conversations[convoId].lastUnread !== null
  ).map(convoId => conversations[convoId]);
}

/**
 * Parses out the submission link from the modmail message
 * @param  {Message} message The message as returned from getModmail
 * @return {string}          The link to the submission
 */
function getSubmissionLinkFromModmail(message: Message): string {
  return message.bodyMarkdown.split('Post: ')[1];
}

export async function run(): Promise<void> {
  try {
    const authToken = await getAccessToken();
    console.log(`Got OAuth token`, authToken);
  } catch (e) {
    console.error(`Error getting OAuth token`, e);
    return;
  }

  try {
    const { conversations, messages } = await getModmail();
    const unreadConversations = filterUnreadConversations(conversations);

    await Promise.all(unreadConversations.map(async convo => {
      const msgId = convo.objIds[0].id;
      const submissionLink = getSubmissionLinkFromModmail(messages[msgId]);
      console.log(`Processing submission ${submissionLink}`);

      try {
        const commentId = await addTrackbackLinkComment(convo.id, submissionLink);
        console.log('Added trackback comment, id:', commentId);
        await removeTrackbackLinkComment(commentId);
        console.log('Removed trackback comment');
        await markAsRead(convo.id);
        console.log('Marked conversation as read');
      } catch (err) {
        console.error(`Could not process modmail ${convo.id} for submission ${submissionLink}`);
        console.error(inspect(err));
      }
    }));

    console.log('All done!');
  } catch (e) {
    console.error(e);
  }
}
