# Modmail Trackback

Adds a comment to new submissions with a link back to the modmail thread for it.

## How it works
When the process starts, the bot starts checking for any new modmail using the provided user account at the specified interval.

If it finds any unread modmail from AutoModerator whose message body contains the string "There is a new post", it will parse the submission link from the message (using the provided `SUBMISSION_MATCH_PATTERN`), post a comment on that submission linking back to the modmail thread, remove the comment so only mods can see it, then mark the message as read.

It is important to use a dedicated user account for this since it relies on the read/unread status of the modmail message.

Currently this only works for the old modmail system because the new modmail API is missing a lot of features. See this thread: https://www.reddit.com/r/redditdev/comments/5kbs1k/whats_the_best_way_to_determine_if_a_conversation/

## Running

If you have `yarn` installed, run `yarn install` to install the dependencies. Otherwise run `npm install`.

`<env vars> node .`

### Environment variables

| name | description | required | default value |
|------|-------------|----------|---------------|
| `USER` | the username for the reddit account that will be adding the comments | yes | |
| `PASS` | the password for the reddit account that will be adding the comments | yes | |
| `APP_ID` | the app id that reddit gives you when you create a new developer app | yes | |
| `APP_SECRET` | the app secret that reddit gives you when you create a new developer app | yes | |
| `INTERVAL` | the interval (in minutes) that the script should check for new submissions | no | 5 |
| `SUBREDDIT` | the name of the subreddit that should be checked for submissions | yes | |
| `USE_OLD_MODMAIL` | set this to `true` if the subreddit is using the old modmail system | no | `false ` |
| `SUBMISSION_MATCH_PATTERN` | this will be used to find the link to the submission in the modmail message. for example, if your modmail message contains something like "Post: https://reddit.com/r/yourSubreddit/comments/c87ba9/foo", you could use a pattern like `Post: (.+)\/` | yes | |
| `PORT` | the port that the http server will listen to (this is just used so you can ping the service to make sure the process is still running) | no | 5000 |

## TODO
  - get it working with the new modmail
  - tests
