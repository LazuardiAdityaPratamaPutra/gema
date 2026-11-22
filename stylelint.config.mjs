const config = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['.next/**', 'node_modules/**', 'public/**'],
  rules: {
    // CSS berlapis per zona: urutan sengaja menentukan cascade, bukan kekhususan.
    'no-descending-specificity': null,
    'selector-class-pattern': null,
    'keyframes-name-pattern': null,
    'custom-property-pattern': null,
    'declaration-empty-line-before': null,
    // Utilitas sengaja memakai !important (menggantikan style inline).
    'declaration-no-important': null,
    'comment-empty-line-before': null,
    // :not(a):not(b) dan :not(a, b) punya kekhususan berbeda; urutan cascade di sini bergantung padanya.
    'selector-not-notation': null,
  },
};

export default config;
