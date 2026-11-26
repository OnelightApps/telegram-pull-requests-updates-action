// The inline comments of one review, so a review is one Telegram message instead of 1 + N.

export interface ReviewComment {
  body: string;
  path: string;
  html_url: string;
  in_reply_to_id?: number;
}

export const MAX_LISTED_COMMENTS = 5;
const EXCERPT_LENGTH = 150;

/*Escape markdown characters based on
  https://core.telegram.org/bots/api#markdownv2-style
  ignore pre and code entities as we do not use.
*/
export const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
};

// Inside a code entity only ` and \ need escaping.
const escapeCode = (text: string): string => text.replace(/([\\`])/g, "\\$1");

// A reply in a thread, or "Add single comment", is a review with no text and one comment:
// send it as that comment, which is what the reader cares about.
export const singleComment = (
  review: { body: string | null; state: string },
  comments: ReviewComment[]
): ReviewComment | undefined =>
  comments.length === 1 && !(review.body ?? "").trim() && review.state.toLowerCase() === "commented"
    ? comments[0]
    : undefined;

const plainLine = (line: string): string =>
  line.replace(/^[#>\s]+/, "").replace(/\*\*|__|~~|`/g, "").trim();

// The review comments API has no line numbers, so an entry names the file and links the comment.
export const formatCommentList = (comments: ReviewComment[], listed = MAX_LISTED_COMMENTS): string => {
  if (comments.length === 0) return "";

  const lines = comments.slice(0, listed).map((comment) => {
    const file = comment.path.split("/").pop() ?? comment.path;
    // Plain text: a clipped excerpt can't keep its markdown entities balanced.
    const firstLine = comment.body.split("\n").map(plainLine).find((l) => l) ?? "";
    const excerpt = firstLine.length > EXCERPT_LENGTH ? firstLine.slice(0, EXCERPT_LENGTH) + "…" : firstLine;
    return `• [${escapeMarkdown(file)}](${comment.html_url}) ${escapeMarkdown(excerpt)}`;
  });
  const more = comments.length - lines.length;
  if (more > 0) lines.push(escapeMarkdown(`…and ${more} more`));

  return `*Comments \\(${comments.length}\\):*\n${lines.join("\n")}`;
};

export const formatLocation = (comment: ReviewComment): string => "`" + escapeCode(comment.path) + "`";
