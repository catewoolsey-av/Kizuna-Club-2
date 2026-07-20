// src/utils/random.js

// Generate proper UUIDs for Supabase compatibility
export const genId = () => {
  // Use native crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 generator for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getEmoji = () =>
  ["🏢", "🏭", "💹", "🔬", "🧬", "🛒", "🎯", "💼", "🌟", "🚀"][
    Math.floor(Math.random() * 10)
  ];

export const getLogo = () =>
  ["🤖", "🌿", "🦾", "🧬", "🛡️", "💳", "🔮", "⚡", "🎯", "🌐"][
    Math.floor(Math.random() * 10)
  ];