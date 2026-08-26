const ATTACHMENT_CATEGORIES = Object.freeze({
  PHOTOGRAPH: 'PHOTOGRAPH',
  DOCUMENT: 'DOCUMENT',
  INSPECTION_EVIDENCE: 'INSPECTION_EVIDENCE',
  OTHER: 'OTHER',
});

function isValidAttachmentCategory(category) {
  return Object.values(ATTACHMENT_CATEGORIES).includes(category);
}

module.exports = {
  ATTACHMENT_CATEGORIES,
  isValidAttachmentCategory,
};