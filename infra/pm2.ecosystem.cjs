// PM2 Ecosystem — Yaya Business + Yaya Health
// Unified process management with structured logging & observability

module.exports = {
  apps: [
    {
      name: 'yaya-business',
      cwd: '/home/yaya/yaya_business/autobot',
      script: 'dist/index.js',
      interpreter: '/usr/bin/node',
      node_args: '--enable-source-maps',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        SERVICE_NAME: 'yaya-business',
      },
      // Logging — structured, separate files
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      error_file: '/home/yaya/logs/yaya-business-error.log',
      out_file: '/home/yaya/logs/yaya-business-out.log',
      merge_logs: true,
      // Restart policy
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 15000,
      shutdown_with_message: true,
      // Crash tracking
      max_memory_restart: '2G',
    },
    {
      name: 'yaya-health',
      cwd: '/home/yaya/yaya_health',
      script: 'dist/index.js',
      interpreter: 'node',
      node_args: '--enable-source-maps',
      env: {
        PORT: 3100,
        NODE_ENV: 'production',
        SERVICE_NAME: 'yaya-health',
      },
      // Logging — structured, separate files
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      error_file: '/home/yaya/logs/yaya-health-error.log',
      out_file: '/home/yaya/logs/yaya-health-out.log',
      merge_logs: true,
      // Restart policy
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 15000,
      shutdown_with_message: true,
      // Crash tracking
      max_memory_restart: '1G',
    },
  ],
};
