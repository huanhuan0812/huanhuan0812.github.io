// 配置常量
require('dotenv').config();

const GITHUB_TOKEN = process.env.MY_GITHUB_TOKEN; // 替换为你的Token
const CACHE_EXPIRY = 30 * 60 * 1000; // 30分钟缓存
const BATCH_SIZE = 2; // 分批加载数量

// DOM元素
const reposContainer = document.getElementById('repos-container');
const loadingSpinner = document.getElementById('loading-spinner');

// 主函数
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 显示加载状态
        loadingSpinner.style.display = 'block';

        // 加载配置
        const config = await fetch('_config.yml').then(response => response.text());
        const repos = jsyaml.load(config).repositories;

        // 分批加载仓库
        for (let i = 0; i < repos.length; i += BATCH_SIZE) {
            const batch = repos.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(processRepo));
        }
    } catch (error) {
        console.error('初始化失败:', error);
    } finally {
        loadingSpinner.style.display = 'none';
    }
});

// 处理单个仓库
async function processRepo(repo) {
    try {
        const [repoData, commits] = await Promise.all([
            fetchWithCache(`repo_${repo.owner}_${repo.name}`,
                () => fetchRepoData(repo.owner, repo.name)),
            fetchWithCache(`commits_${repo.owner}_${repo.name}_${repo.branch || 'main'}`,
                () => fetchCommits(repo.owner, repo.name, repo.branch || 'main'))
        ]);

        const repoElement = createRepoElement(repo, repoData, commits);
        reposContainer.appendChild(repoElement);
    } catch (error) {
        showError(repo, error);
    }
}

// 带缓存的请求
async function fetchWithCache(cacheKey, fetchFn) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) return data;
    }

    const data = await fetchFn();
    localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
    return data;
}

// GitHub API请求
async function fetchRepoData(owner, name) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    return response.json();
}

async function fetchCommits(owner, name, branch) {
    const response = await fetch(
        `https://api.github.com/repos/${owner}/${name}/commits?sha=${branch}&per_page=5`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    return response.json();
}

// 创建仓库元素（安全方式）
function createRepoElement(repo, repoData, commits) {
    const element = document.createElement('div');
    element.className = 'repo-card';

    // 使用DOM API创建元素而不是innerHTML
    const header = document.createElement('div');
    header.className = 'repo-header';

    const titleLink = document.createElement('a');
    titleLink.href = repoData.html_url;
    titleLink.target = '_blank';
    titleLink.textContent = `${repo.owner}/${repo.name}`;

    const title = document.createElement('h3');
    title.appendChild(titleLink);
    header.appendChild(title);

    // 添加其他元素...
    element.appendChild(header);

    return element;
}

// 显示错误
function showError(repo, error) {
    const element = document.createElement('div');
    element.className = 'repo-card error';

    const title = document.createElement('h3');
    title.textContent = `${repo.owner}/${repo.name}`;

    const message = document.createElement('p');
    message.textContent = `加载失败: ${error.message}`;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = '重试';
    retryBtn.addEventListener('click', () => processRepo(repo));

    element.append(title, message, retryBtn);
    reposContainer.appendChild(element);
}

// 工具函数
function truncate(str, n) {
    const cleanStr = str.replace(/\n/g, ' ').trim();
    return (cleanStr.length > n) ? cleanStr.substring(0, n-1) + '...' : cleanStr;
}
