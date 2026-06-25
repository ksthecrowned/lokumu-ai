const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        lokumu: {
          primary: '#007FFF',
          accent: '#F7D618',
          red: '#CE1126',
          ink: '#0F172A',
          mist: '#F8FAFC',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -20px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
