/* @flow */

import { inspect } from 'util';
import { useOldModmail, userAgent } from './constants';
import {
  getAccessToken,
  listOldModmail,
  listNewModmail,
  markMessageRead,
  markMessageReadOld,
  addTrackbackLinkComment,
  removeTrackbackLinkComment,
  getSubmissionLinkFromMessageBody,
} from './utils';

import type { Headers, ModmailList } from './types';

export default class Worker {
  headers: Headers;
  headers = {
    'User-Agent': userAgent,
    Authorization: '',
  };

  async run(): Promise<void> {
    try {
      await this.getAccessToken();
    } catch (e) {
      console.error(e);
      return;
    }

    try {
      const messages = await this.listMessages();

      if (!messages.length) {
        console.log('Nothing to do, no new messages!');
        return;
      }

      await Promise.all(messages.map(async msg => {
        const submissionLink = getSubmissionLinkFromMessageBody(msg.body);

        if (!submissionLink) return;

        console.log('Processing submission', submissionLink);

        try {
          const commentId = await this.addTrackbackLinkComment(msg.id, submissionLink);

          if (!commentId) return;

          console.log('Added trackback comment', commentId);
          await this.removeTrackbackLinkComment(commentId);
          console.log('Removed trackback comment', commentId);
          await this.markMessageRead(msg.id);
          console.log('Marked modmail message as read');
        } catch (err) {
          console.error(`Could not process modmail ${msg.id} for submission ${submissionLink}`);
          console.error(inspect(err));
        }
      }));

      console.log('All done! Until next time...');
    } catch (err) {
      console.error(err);
    }
  }

  async getAccessToken(): Promise<void> {
    const accessToken = await getAccessToken();
    console.log('Got access_token', accessToken);
    this.headers.Authorization = `bearer ${accessToken}`;
  }

  async listMessages(): Promise<ModmailList> {
    return useOldModmail ? listOldModmail(this.headers) : listNewModmail(this.headers);
  }

  async markMessageRead(id: string): Promise<void> {
    return useOldModmail ? markMessageReadOld(this.headers, id) : markMessageRead(this.headers, id);
  }

  async addTrackbackLinkComment(messageId: string, submissionLink: string): Promise<?string> {
    return addTrackbackLinkComment(this.headers, messageId, submissionLink);
  }

  async removeTrackbackLinkComment(commentId: string): Promise<void> {
    return removeTrackbackLinkComment(this.headers, commentId);
  }
}
