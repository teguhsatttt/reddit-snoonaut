require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const https = require('https');

// Telegram
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegram(msg) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`;
  https.get(url, (res) => {
    console.log('Telegram status:', res.statusCode);
  }).on('error', (err) => {
    console.error('Telegram error:', err.message);
  });
}

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log('-----------------------------------------------');
    console.log('  🍉🍉 19Seniman From Insiders - FREE PALESTINE 🍉🍉 ');
    console.log('-----------------------------------------------');
    console.log(`${colors.reset}\n`);
  },
};

const randomUA = () => {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
};

const generateProofUrl = () => {
  const usernames = ['altcoinbear1', 'cryptofan', 'snootlover', 'airdropking', 'blockchainbro'];
  const randomStatusId = Math.floor(1000000000000000000 + Math.random() * 900000000000000000);
  const randomUsername = usernames[Math.floor(Math.random() * usernames.length)];
  return `https://x.com/${randomUsername}/status/${randomStatusId}`;
};

const getProxyAgent = () => {
  if (fs.existsSync('proxies.txt')) {
    const proxies = fs.readFileSync('proxies.txt', 'utf-8').split('\n').filter(Boolean);
    if (proxies.length > 0) {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];
      const proxyUrl = proxy.includes('http') ? proxy : `http://${proxy}`;
      return new HttpsProxyAgent(proxyUrl);
    }
  }
  return null;
};

const loadCookies = () => {
  return Object.keys(process.env)
    .filter(key => key.startsWith('COOKIE_'))
    .map(key => process.env[key]);
};

const createAxiosInstance = (cookie) => axios.create({
  baseURL: 'https://earn.snoonaut.xyz/api',
  headers: {
    'accept': '*/*',
    'cookie': cookie,
    'User-Agent': randomUA(),
    'Referer': 'https://earn.snoonaut.xyz/home'
  },
});

const fetchUserInfo = async (axiosInstance) => {
  logger.loading('Fetching user info...');
  sendTelegram('[⟳] Fetching user info...');
  try {
    const res = await axiosInstance.get('/user/stats', {
      httpsAgent: getProxyAgent()
    });
    logger.success('User info fetched successfully');
    const { username, snootBalance } = res.data.user;
    logger.info(`Username: ${username}, Snoot Balance: ${snootBalance}`);
    sendTelegram(`[✅] Username: ${username}, 💰 Snoot Balance: ${snootBalance}`);
    return res.data;
  } catch (e) {
    logger.error('Failed to fetch user info');
    sendTelegram(`❌ Gagal ambil user info: ${e.message}`);
    return null;
  }
};

const fetchTasks = async (axiosInstance, type) => {
  logger.loading(`Fetching ${type} tasks...`);
  sendTelegram(`[⟳] Fetching ${type} tasks...`);
  try {
    const res = await axiosInstance.get(`/tasks?type=${type}`, {
      httpsAgent: getProxyAgent()
    });
    logger.success(`${type} tasks fetched successfully`);
    sendTelegram(`[✅] ${type} tasks fetched successfully`);
    return res.data.tasks;
  } catch (e) {
    logger.error(`Failed to fetch ${type} tasks`);
    sendTelegram(`❌ Gagal fetch ${type} tasks: ${e.message}`);
    return [];
  }
};

const completeTask = async (axiosInstance, task, type = 'engagement') => {
  logger.loading(`Completing task ${task.title} (${task.id})...`);
  
  // Hanya kirim notifikasi Telegram untuk task engagement
  if (type === 'engagement') {
    sendTelegram(`[⟳] Completing task ${task.title} (${task.id})...`);
  }

  try {
    const payload = { taskId: task.id, action: 'complete' };
    
    // Tambahkan proofUrl jika task jenis tertentu
    if (['Spread the Snoot!', 'Like, Retweet and Comment'].includes(task.title)) {
      payload.proofUrl = generateProofUrl();
    }

    const res = await axiosInstance.post('/tasks/complete', payload, {
      httpsAgent: getProxyAgent(),
      headers: {
        'User-Agent': randomUA(),
        'content-type': 'application/json',
      }
    });

    if (res.data.success) {
      logger.success(`Task ${task.title} completed, Reward: ${res.data.reward}`);
      if (type === 'engagement') {
        sendTelegram(`[✅] Task ${task.title} selesai! 🎁 Reward: ${res.data.reward}`);
      }
    }
  } catch (e) {
    logger.error(`Failed to complete task ${task.title} (${task.id})`);
    if (type === 'engagement') {
      sendTelegram(`❌ Gagal selesaikan ${task.title}: ${e.message}`);
    }
  }
};

const main = async () => {
  logger.banner();
  const cookies = loadCookies();
  if (cookies.length === 0) {
    logger.error('No cookies found in .env');
    sendTelegram('❌ Tidak ada COOKIE ditemukan di .env!');
    return;
  }
  for (const cookie of cookies) {
    await processAccount(cookie);
  }
  logger.success('✅ Semua akun selesai diproses');
  sendTelegram('✅ Semua akun selesai diproses');
};

main().catch((e) => {
  logger.error(`Fatal error: ${e.message}`);
  sendTelegram(`❌ Fatal error: ${e.message}`);
});
