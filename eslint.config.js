// eslint.config.js
import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';

export default [
  // Baseline recommended configurations for JS and Vue
  pluginJs.configs.recommended,
  ...pluginVue.configs['flat/recommended'], // Added '...' to spread the array
  
  // Your custom configuration object
  {
    files: ['src/**/*.{js,vue}'],
    
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
];