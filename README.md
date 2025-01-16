# Telegram Pull Request Updates
---
A simple Github action that sends a Telegram message when:
1. Pull request: opened, review requested, synchronize, closed
2. Pull request review: submitted, edited, dismissed
3. Pull request review comment: created, edited, deleted
---
## Usage
To use this action you need setup your workflow to trigger on pull request events.

#### Example 

```yml 
on:
  pull_request:
    types: [ opened, ready_for_review, review_requested, synchronize, closed ]
  pull_request_review:
    types: [ submitted, edited, dismissed ]
  pull_request_review_comment:
    types: [ created, edited, deleted ]
```
<br/>
You can include this action in your workflow as follow

```yml
- name: Pull Request Telegram Updates
  uses: OnelightApps/telegram-pull-requests-updates-action@v1.4.0
  with: 
    bot_token: '${{ secrets.BotToken }}' # Your bot token from github secrets
    chat_id: '${{ secrets.CHATID }}' # Your chat id from github secrets
    topic_id: '${{ TOPIC_ID }}' # Your topic id
```


`Github Secrets:` To add your bot toekn and chat id as a github secret  you can refer to [Github docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository). <br>

`Bot Token:` To get a bot token you need to use [BotFather](https://t.me/botfather) on Telegram
or refer to [this](https://core.telegram.org/bots#3-how-do-i-create-a-bot) on how to create a bot.

`Chat ID:` You may use this [RawDataBot](https://t.me/RawDataBot) to get the chat id the for a group or a channel.

---

---

### Notes
When a review is requested this action will run for every reviewer.
