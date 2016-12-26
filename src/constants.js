/* @flow */

export const username = process.env.USER;
export const password = process.env.PASS;
export const appId = process.env.APP_ID;
export const appSecret = process.env.APP_SECRET;
export const subreddit = process.env.SUBREDDIT || '';
export const useOldModmail = process.env.USE_OLD_MODMAIL === 'true'; // env vars are strings
export const submissionMatchPattern = process.env.SUBMISSION_MATCH_PATTERN || '';
export const submissionMatchRegex = new RegExp(submissionMatchPattern);

export const apiBaseUrl = 'https://oauth.reddit.com/api';
export const userAgent = 'modmail-trackback-link';
