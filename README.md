# Modmail Trackback

Adds a comment to new submissions with a link back to the modmail thread for it.

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
