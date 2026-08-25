import * as core from "@actions/core";
import * as github from "@actions/github";
import sendMessage from "./send_message";
import { PullRequestEvent, PullRequestReviewEvent, PullRequestReviewCommentEvent } from "@octokit/webhooks-types";
import { User } from "@octokit/webhooks-types";

async function run(): Promise<void> {
  try {
    const botToken = core.getInput("bot_token");
    const chatId = core.getInput("chat_id");
    const topicId = core.getInput("topic_id");

    if (!botToken || !chatId) {
      throw new Error("bot_token and chat_id are required");
    }

    const uri = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let message = "";

    if (github.context.eventName == "pull_request") {
      const payload = github.context.payload as PullRequestEvent;
      message = formatPullRequestMessage(payload);
    } else if (github.context.eventName == "pull_request_review") {
      const payload = github.context.payload as PullRequestReviewEvent;
      message = formatPullRequestReviewMessage(payload);
    } else if (github.context.eventName == "pull_request_review_comment") {
      const payload = github.context.payload as PullRequestReviewCommentEvent
      message = formatPullRequestReviewCommentMessage(payload);
    } else {
      throw new Error(
        "This action only works on pull_request & pull_request_review & pull_request_review_comment events"
      );
    }

    await sendMessage(chatId, topicId, message, uri);

    core.debug(`Message sent!`);
    core.setOutput("Finshed time", new Date().toTimeString());
  } catch (error) {
    console.debug(`Error: `, error);

    if (error instanceof Error) core.setFailed(error.message);
  }
}

// Format the pull request message based on the event type, new pull or review request.
const formatPullRequestMessage = (payload: PullRequestEvent): string => {
  const { action, pull_request, repository, sender, number } = payload;
  const { name, owner } = repository;
  const { title, body, draft } = pull_request;

  const prTitle = escapeMarkdown(title);
  const prDescription = escapeMarkdown(body ?? "");
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);

  let message = "";

  switch (action) {
    case "opened":
      message = `🚀*Opened* \\\#${number}
      *PR Title:* ${prTitle}
      *PR Description:* ${prDescription}
      *Draft:* ${draft}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "ready_for_review":
      message = `✔️*Ready For Review* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "closed":
      message = `❌ *Closed* \\\#${number}
      *PR Title:* ${prTitle}
      *Draft:* ${draft}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "review_requested":
      const { requested_reviewers } = pull_request;
      const reviewer = requested_reviewers[0];
      const { name } = reviewer;
      const { login } = reviewer as User;
      const reviewerName = escapeMarkdown(name ?? login ?? "");

      message = `📝 *Review Requested*  \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *For:* [${reviewerName}](https://github.com/${reviewerName})
      [View Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "synchronize":
      const { diff_url } = pull_request;
      message = `🔄 *Updated* \\\#${number}
      *PR Title:* ${prTitle}
      *Draft:* ${draft}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Difference](${diff_url})
      [View Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

// Format the pull request review message based on the event type, new pull or review request.
const formatPullRequestReviewMessage = (payload: PullRequestReviewEvent): string => {
  const { action, pull_request, repository, sender, review } = payload;
  const { name, owner } = repository;
  const { title, number, draft } = pull_request;
  const { body, html_url, state } = review;

  const prTitle = escapeMarkdown(title);
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);
  const prState = escapeMarkdown(state);
  const reviewText = escapeMarkdown(body ?? "");

  let message = "";

  switch (action) {
    case "submitted":
      message = `✅ *Review submitted* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Status: ${prState}*
      *Text: ${reviewText}*
      [View Review](${html_url})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "dismissed":
      message = `❎ *Review dismissed* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "edited":
      message = `❇️ *Review edited* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Status: ${prState}*
      *Text: ${reviewText}*
      [View Review](${html_url})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

// Format the pull request review comment message based on the event type, new pull or review request.
const formatPullRequestReviewCommentMessage = (payload: PullRequestReviewCommentEvent): string => {
  const { action, pull_request, repository, sender, comment } = payload;
  const { name, owner } = repository;
  const { title, number } = pull_request;
  const { body, html_url } = comment;

  const prTitle = escapeMarkdown(title);
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);
  const commentText = escapeMarkdown(body ?? "");

  let message = "";

  switch (action) {
    case "created":
      message = `📝 *New comment* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Text: ${commentText}*
      [View Comment](${html_url})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "deleted":
      message = `🗑 *Comment deleted* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    case "edited":
      message = `✏️ *Comment edited* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Text: ${commentText}*
      [View Comment](${html_url})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

/*Escape markdown characters based on
  https://core.telegram.org/bots/api#markdownv2-style
  ignore pre and code entities as we do not use.
*/
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
};

run();
