/** Tokens per Design.md — Tailwind's default indigo/gray/green/amber/red/blue
 * scales match the hex values specified there (e.g. indigo-600 = #4F46E5). */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};
