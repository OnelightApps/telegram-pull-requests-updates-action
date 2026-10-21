import * as core from "@actions/core";
import * as github from "@actions/github";
import sendMessage from "./send_message";
import { PullRequestEvent, PullRequestReviewEvent, PullRequestReviewCommentEvent } from "@octokit/webhooks-types";
import { User } from "@octokit/webhooks-types";
import telegramifyMarkdown from "telegramify-markdown";
import axios from "axios";

async function run(): Promise<void> {
  try {
    const botToken = core.getInput("bot_token");
    const chatId = core.getInput("chat_id");
    const topicId = core.getInput("topic_id");

    if (!botToken || !chatId) {
      throw new Error("bot_token and chat_id are required");
    }

    const uri = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const message = buildMessage();

    try {
      await sendMessage(chatId, topicId, message, uri);
    } catch (error) {
      // Telegram rejects broken entities with 400, so resend with plain escaped text.
      if (!axios.isAxiosError(error) || error.response?.status !== 400) throw error;
      console.debug("Rich text rejected, resending escaped: ", error.response?.data);
      richText = false;
      await sendMessage(chatId, topicId, buildMessage(), uri);
    }

    core.debug(`Message sent!`);
    core.setOutput("Finshed time", new Date().toTimeString());
  } catch (error) {
    console.debug(`Error: `, error);

    if (error instanceof Error) core.setFailed(error.message);
  }
}

// Rebuilt on fallback, so keep it free of side effects.
const buildMessage = (): string => {
  if (github.context.eventName == "pull_request") {
    const payload = github.context.payload as PullRequestEvent;
    return formatPullRequestMessage(payload);
  } else if (github.context.eventName == "pull_request_review") {
    const payload = github.context.payload as PullRequestReviewEvent;
    return formatPullRequestReviewMessage(payload);
  } else if (github.context.eventName == "pull_request_review_comment") {
    const payload = github.context.payload as PullRequestReviewCommentEvent
    return formatPullRequestReviewCommentMessage(payload);
  } else {
    throw new Error(
      "This action only works on pull_request & pull_request_review & pull_request_review_comment events"
    );
  }
};

// Format the pull request message based on the event type, new pull or review request.
const formatPullRequestMessage = (payload: PullRequestEvent): string => {
  const { action, pull_request, repository, sender, number } = payload;
  const { name, owner } = repository;
  const { title, body, draft } = pull_request;

  const prTitle = formatTitle(title);
  const prDescription = formatBody(body);
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);

  let message = "";

  switch (action) {
    case "opened":
      message = `🚀*Opened* \\\#${number}
      *PR Title:* ${prTitle}
      *PR Description:*
      ${prDescription}
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

  const prTitle = formatTitle(title);
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);
  const prState = escapeMarkdown(state);
  const reviewText = formatBody(body);

  let message = "";

  switch (action) {
    case "submitted":
      message = `✅ *Review submitted* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Status: ${prState}*
      *Text:* ${reviewText}
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
      *Text:* ${reviewText}
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

  const prTitle = formatTitle(title);
  const ownerName = escapeMarkdown(owner.login);
  const repoName = escapeMarkdown(name);
  const senderName = escapeMarkdown(sender.login);
  const commentText = formatBody(body);

  let message = "";

  switch (action) {
    case "created":
      message = `📝 *New comment* \\\#${number}
      *PR Title:* ${prTitle}
      *By:* [${senderName}](https://github.com/${senderName})
      *Text:* ${commentText}
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
      *Text:* ${commentText}
      [View Comment](${html_url})
      [View Pull Request](https://github.com/${ownerName}/${repoName}/pull/${number})
      `;
      console.debug("Message: ", message);
      return message;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

let richText = true;

// Leaves room under Telegram's 4096 limit for the rest of the message and escaping growth.
const MAX_BODY_LENGTH = 1500;

// GitHub titles have no markdown except `code`, so only that is kept as an entity.
const formatTitle = (text: string): string => {
  if (!richText) return escapeMarkdown(text);

  return text
    .split(/(`[^`]+`)/)
    .map((part) =>
      /^`[^`]+`$/.test(part)
        ? "`" + part.slice(1, -1).replace(/([\\`])/g, "\\$1") + "`"
        : escapeMarkdown(part)
    )
    .join("");
};

// Converts GitHub markdown (links, bold, code...) to Telegram MarkdownV2.
const formatBody = (text: string | null | undefined): string => {
  const source = text ?? "";
  if (!richText) return escapeMarkdown(source);

  const clipped = source.length > MAX_BODY_LENGTH ? source.slice(0, MAX_BODY_LENGTH) + "…" : source;
  return telegramifyMarkdown(clipped, "escape").trim();
};

/*Escape markdown characters based on
  https://core.telegram.org/bots/api#markdownv2-style
  ignore pre and code entities as we do not use.
*/
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
};

run();
