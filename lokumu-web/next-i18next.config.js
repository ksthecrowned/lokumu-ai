module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'sw', 'ha', 'yo'],
  },
  localePath: typeof window === 'undefined' ? './public/locales' : '/locales',
};
