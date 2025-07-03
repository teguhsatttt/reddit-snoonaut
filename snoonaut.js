require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Logger
const logger = {
  info: (msg) => console.log(`[i] ${msg}`),
  warn: (msg) => console.log(`[!] ${msg}`),
  error: (msg) => console.log(`[x] ${msg}`),
  success: (msg) => console.log(`[✓] ${msg}`),
  loading: (msg) => console.log(`[⟳] ${msg}`),
  step: (msg) => console.log(`[➤] ${msg}`),
  banner: () => console.log(`\n--- Snoonaut Auto Bot ---\n`)
};

// Send Telegram
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const sendTelegram = async (msg) => {
  if (!TOKEN || !CHAT_ID) return;
  try {
    await axios.get(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      params: {
        chat_id: CHAT_ID,
        text: msg
      }
    });
  } catch (e) {
    logger.warn(`Gagal kirim Telegram: ${e.message}`);
  }
};

// Utility
const randomUA = () => {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
};

const generateProofUrl = () => {
  const usernames = ['airdropking', 'snootlover'];
  const statusId = Math.floor(1000000000000000000 + Math.random() * 999999999999999999);
  return `https://x.com/${usernames[Math.floor(Math.random() * usernames.length)]}/status/${statusId}`;
};

const getProxyAgent = () => {
  if (fs.existsSync('proxies.txt')) {
    const proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(Boolean);
    if (proxies.length > 0) {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];
      return new HttpsProxyAgent(proxy.includes('http') ? proxy : `http://${proxy}`);
    }
  }
  return null;
};

const loadCookies = () => {
  return Object.entries(process.env)
    .filter(([k]) => k.startsWith('COOKIE_'))
    .map(([_, v]) => v);
};

const createAxiosInstance = (cookie) =>
  axios.create({
    baseURL: 'https://earn.snoonaut.xyz/api',
    headers: {
      cookie,
      'User-Agent': randomUA(),
      Referer: 'https://earn.snoonaut.xyz/home'
    }
  });

const fetchUserInfo = async (axiosInstance) => {
  logger.loading('Fetching user info...');
  try {
    const res = await axiosInstance.get('/user/stats', {
      httpsAgent: getProxyAgent()
    });
    const { username, snootBalance } = res.data.user;
    logger.success('User info fetched successfully');
    logger.info(`Username: ${username}, Snoot Balance: ${snootBalance}`);
    await sendTelegram(`[✓] Username: ${username}, Snoot Balance: ${snootBalance}`);
    return res.data.user;
  } catch (e) {
    logger.error('Failed to fetch user info');
    return null;
  }
};

const fetchTasks = async (axiosInstance, type) => {
  logger.loading(`Fetching ${type} tasks...`);
  try {
    const res = await axiosInstance.get(`/tasks?type=${type}`, {
      httpsAgent: getProxyAgent()
    });
    logger.success(`${type} tasks fetched successfully`);
    return res.data.tasks;
  } catch (e) {
    logger.error(`Failed to fetch ${type} tasks`);
    return [];
  }
};

const completeTask = async (axiosInstance, task) => {
  if (task.type === 'referral') {
    logger.loading(`Skipping referral task ${task.title} (${task.id})`);
    return;
  }

  logger.loading(`Completing task ${task.title} (${task.id})...`);
  try {
    const payload = { taskId: task.id, action: 'complete' };
    if (["Spread the Snoot!", "Like, Retweet and Comment"].includes(task.title)) {
      payload.proofUrl = generateProofUrl();
    }

    const res = await axiosInstance.post('/tasks/complete', payload, {
      httpsAgent: getProxyAgent(),
      headers: {
        'User-Agent': randomUA(),
        'content-type': 'application/json'
      }
    });

    if (res.data.success) {
      logger.success(`Task ${task.title} completed, Reward: ${res.data.reward}`);
      await sendTelegram(`[✅] Task ${task.title} selesai! 🎁 Reward: ${res.data.reward}`);
    }
  } catch (e) {
    logger.error(`Failed to complete task ${task.title}`);
  }
};

const processAccount = async (cookie) => {
  logger.step(`Processing account: ${cookie.slice(0, 30)}...`);
  const axiosInstance = createAxiosInstance(cookie);

  const userInfo = await fetchUserInfo(axiosInstance);
  if (!userInfo) return;

  const engagementTasks = await fetchTasks(axiosInstance, 'engagement');
  const referralTasks = await fetchTasks(axiosInstance, 'referral');
  const allTasks = [...engagementTasks, ...referralTasks].filter(t => t.status === 'pending');

  for (const task of allTasks) {
    await completeTask(axiosInstance, task);
  }

  logger.success('All tasks processed');
};

const main = async () => {
  logger.banner();
  const cookies = loadCookies();
  if (cookies.length === 0) {
    logger.error('Tidak ada COOKIE ditemukan.');
    return;
  }

  for (const cookie of cookies) {
    await processAccount(cookie);
  }
};

main()
  .then(() => {
    const message = '✅ Semua akun selesai diproses';
    logger.success(message);
    sendTelegram(message); // Kirim notifikasi ke Telegram
  })
  .catch(err => {
    logger.error(`❌ Error utama: ${err.message}`);
    sendTelegram(`❌ Error utama: ${err.message}`);
  })
  .finally(() => {
    process.exit(0);
  });
