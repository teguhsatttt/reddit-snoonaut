require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const https = require('https');

// ----------------- LOGGER + WARNA -----------------
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m"
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
    console.log('   🤖 Snoonaut Auto Bot - lim.js  ');
    console.log('-----------------------------------------------');
    console.log(`${colors.reset}`);
  }
};

// ----------------- TELEGRAM -----------------
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const sendTelegram = (msg) => {
  if (!TOKEN || !CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`;
  https.get(url, res => {}).on('error', () => {});
};

// ----------------- RANDOM TOOLS -----------------
const randomUA = () => {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
};

const generateProofUrl = () => {
  const users = ['snootlover', 'airdropking'];
  const id = Math.floor(1e18 + Math.random() * 9e18);
  return `https://x.com/${users[Math.floor(Math.random() * users.length)]}/status/${id}`;
};

// ----------------- COOKIE & AXIOS -----------------
const loadCookies = () => {
  const cookies = [];
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('COOKIE_')) {
      cookies.push(process.env[key]);
    }
  });
  return cookies;
};

const getProxyAgent = () => {
  if (fs.existsSync('proxies.txt')) {
    const proxies = fs.readFileSync('proxies.txt', 'utf-8').split('\n').filter(Boolean);
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    return new HttpsProxyAgent(proxy.includes('http') ? proxy : `http://${proxy}`);
  }
  return null;
};

const createAxiosInstance = (cookie) => axios.create({
  baseURL: 'https://earn.snoonaut.xyz/api',
  headers: {
    'cookie': cookie,
    'User-Agent': randomUA(),
    'Referer': 'https://earn.snoonaut.xyz/home'
  }
});

// ----------------- API CALLS -----------------
const fetchUserInfo = async (axiosInstance) => {
  logger.loading('Fetching user info...');
  sendTelegram('[⟳] Fetching user info...');
  try {
    const res = await axiosInstance.get('/user/stats', { httpsAgent: getProxyAgent() });
    logger.success('User info fetched successfully');
    logger.info(`Username: ${res.data.user.username}, Snoot Balance: ${res.data.user.snootBalance}`);
    sendTelegram(`[✅] User info OK\n[✓] Username: ${res.data.user.username}, Balance: ${res.data.user.snootBalance}`);
    return res.data;
  } catch (e) {
    logger.error('Failed to fetch user info');
    sendTelegram('❌ Gagal fetch user info');
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
  sendTelegram(`[⟳] Completing task ${task.title} (${task.id})...`);
  try {
    const payload = { taskId: task.id, action: 'complete' };
    if (["Spread the Snoot!", "Like, Retweet and Comment"].includes(task.title)) {
      payload.proofUrl = generateProofUrl();
    }
    const res = await axiosInstance.post('/tasks/complete', payload, {
      httpsAgent: getProxyAgent(),
      headers: { 'User-Agent': randomUA(), 'content-type': 'application/json' }
    });
    if (res.data.success) {
      logger.success(`Task ${task.title} completed, Reward: ${res.data.reward}`);
      sendTelegram(`[✅] Task ${task.title} selesai! 🎁 Reward: ${res.data.reward}`);
    }
  } catch (e) {
    logger.error(`Failed to complete task ${task.title}`);
  }
};

const processAccount = async (cookie) => {
  logger.step(`Processing account: ${cookie.slice(0, 20)}...`);
  const axiosInstance = createAxiosInstance(cookie);
  const userInfo = await fetchUserInfo(axiosInstance);
  if (!userInfo) return;
  const engagementTasks = await fetchTasks(axiosInstance, 'engagement');
  const referralTasks = await fetchTasks(axiosInstance, 'referral');
  const tasks = [...engagementTasks, ...referralTasks].filter(task => task.status === 'pending');
  for (const task of tasks) {
    await completeTask(axiosInstance, task);
  }
  logger.success('✅ Semua task selesai untuk akun ini');
};

// ----------------- MAIN -----------------
const main = async () => {
  logger.banner();
  const cookies = loadCookies();
  if (cookies.length === 0) return logger.error('No cookies found');
  for (const cookie of cookies) {
    await processAccount(cookie);
  }
  logger.success('✅ Semua akun selesai diproses');
};

main().catch((e) => logger.error(`❌ Uncaught error: ${e.message}`));
