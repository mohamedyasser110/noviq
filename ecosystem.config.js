// ============================================================
// NOVIQ — PM2 Process Manager Configuration
// Run with: pm2 start ecosystem.config.js --env production
// ============================================================

module.exports = {
  apps: [
    {
      name: 'noviq-backend',
      cwd: './backend',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4322,
        DB_PATH: './data/noviq.db',
        UPLOADS_DIR: './uploads',
      },
    },
    {
      name: 'noviq-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4321',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4321,
      },
    },
  ],
};
