/**
 * Telegram API helpers — upload and download file chunks.
 * Uses Node 18+ native fetch and FormData (no extra deps needed).
 */

export async function uploadChunkToTelegram(botToken, channelId, chunkData, fileId, chunkIndex) {
  const blob = new Blob([chunkData], { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('chat_id', channelId);
  formData.append('document', blob, `chunk_${fileId}_${chunkIndex}.bin`);
  formData.append('caption', `File: ${fileId} | Chunk: ${chunkIndex}`);

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    { method: 'POST', body: formData }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description} (code: ${result.error_code})`);
  }
  if (!result.result?.message_id) {
    throw new Error('No message_id in Telegram response');
  }
  const telegramFileId = result.result.document?.file_id;
  if (!telegramFileId) {
    throw new Error('No file_id in Telegram response');
  }

  return { messageId: result.result.message_id, telegramFileId };
}

export async function downloadChunkFromTelegram(botToken, telegramFileId) {
  const infoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${telegramFileId}`
  );
  const infoResult = await infoResponse.json();

  if (!infoResult.ok) {
    throw new Error(`Failed to get file info: ${infoResult.description}`);
  }

  const fileResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${infoResult.result.file_path}`
  );

  if (!fileResponse.ok) {
    throw new Error(`Failed to download file: ${fileResponse.statusText}`);
  }

  return fileResponse.arrayBuffer();
}
