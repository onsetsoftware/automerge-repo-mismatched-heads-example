import forms from "@tailwindcss/forms";
import colors from 'tailwindcss/colors.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{html,svelte,js,ts}"],
  theme: {
    extend: {
      colors: {
        gray: colors.slate
      }
    },
  },
  safelist: [
    {
      pattern: /col-span-([234567])/,
    },
  ],
  plugins: [forms],
  variants: {
    extend: {},
  },
  darkMode: "media",
};
