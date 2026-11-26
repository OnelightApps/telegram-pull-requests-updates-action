import axios from "axios";

const MAX_ATTEMPTS = 5;
const MAX_WAIT_SECONDS = 60;

/**
 * Seconds to wait before resending, or undefined when the error is final.
 * A 429 says how long to wait (one message a second per chat, 20 a minute per group);
 * a network error or 5xx is retried with a short backoff.
 */
export const retryDelay = (error: unknown, attempt: number): number | undefined => {
  if (attempt >= MAX_ATTEMPTS || !axios.isAxiosError(error)) return undefined;
  const status = error.response?.status;
  if (status === 429) {
    const after = Number(error.response?.data?.parameters?.retry_after);
    return Math.min((Number.isFinite(after) && after > 0 ? after : 5) + 1, MAX_WAIT_SECONDS);
  }
  if (status === undefined || status >= 500) return 3 * attempt;
  return undefined;
};

/**
 * Send a Telegram message on pull request event.
 * @param chatId id of targeted chat gorup or channel.
 * @param message the message to be sent.
 * @param uri telegram api to send request to.
 */
const sendMessage = async (
  chatId: string,
  topicId: string,
  message: string,
  uri: string,
) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await axios.post(
        uri,
        {
          chat_id: chatId,
          message_thread_id: topicId,
          text: message,
          parse_mode: "Markdownv2",
        },
      );
    } catch (error) {
      const wait = retryDelay(error, attempt);
      if (wait === undefined) throw error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      console.log(`Telegram send failed (${status ?? "network"}), retrying in ${wait}s`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }
  }
};

export default sendMessage;
