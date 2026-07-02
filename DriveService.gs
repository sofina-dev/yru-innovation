/**
 * Optional attachment uploads. Kept intentionally small: one folder,
 * one file per upload, link-shared for read access.
 */

function getUploadFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('UPLOAD_FOLDER_ID');
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (error) {
      // fall through and recreate if the folder was deleted
    }
  }

  let parent = null;
  try {
    const parents = DriveApp.getFileById(getSpreadsheetId_()).getParents();
    parent = parents.hasNext() ? parents.next() : null;
  } catch (error) {
    parent = null;
  }

  const root = parent || DriveApp.getRootFolder();
  const folder = root.createFolder('YRU Innovation - Attachments');
  props.setProperty('UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}

const MAX_ATTACHMENT_BYTES_ = 10 * 1024 * 1024;

function uploadAttachment(token, base64Data, filename, mimeType) {
  requireRole_(token, ['participant', 'admin']);

  if (!base64Data || !filename) {
    throw new Error('ไฟล์ไม่ถูกต้อง');
  }

  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_ATTACHMENT_BYTES_) {
    throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 10MB');
  }

  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', filename);
  const file = getUploadFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: file.getUrl(),
    name: file.getName()
  };
}
