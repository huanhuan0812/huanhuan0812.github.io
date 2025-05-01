// 配置常量
require('dotenv').config();

const CONFIG_PATH = './_config.yml';
const GITHUB_TOKEN = process.env.MY_GITHUB_TOKEN; // 替换为你的Token
const CACHE_EXPIRY = 30 * 60 * 1000; // 30分钟缓存
const BATCH_SIZE = 3; // 分批加载数量

// DOM元素
const reposContainer = document.getElementById('repos-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorContainer = document.getElementById('error-container');

// 主函数
document.addEventListener('DOMContentLoaded', async function() {
    try {
        showLoading();
        
        // 加载配置
        const configText = await loadConfig();
        const repos = jsyaml.load(configText).repositories;
        
        // 分批加载仓库
        for (let i = 0; i < repos.length; i += BATCH_SIZE) {
            const batch = repos.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(processRepo));
        }
    } catch (error) {
        showGlobalError('初始化失败:', error);
    } finally {
        hideLoading();
    }
});

// 加载配置文件
async function loadConfig() {
    try {
        const response = await fetch(CONFIG_PATH);
        if (!response.ok) {
            throw new Error(`配置文件加载失败: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error('加载配置出错:', error);
        // 返回默认配置
        return `
repositories:
  - owner: huanhuan0812
    name: classtools
    branch: main
  - owner: huanhuan0812
    name: runtime1
    branch: main
        `;
    }
}

// 处理单个仓库
async function processRepo(repo) {
    try {
        const cacheKey = `repo_${repo.owner}_${repo.name}`;
        const [repoData, commits] = await Promise.all([
            fetchWithCache(cacheKey, () => fetchRepoData(repo.owner, repo.name)),
            fetchWithCache(`${cacheKey}_commits`, 
                () => fetchCommits(repo.owner, repo.name, repo.branch || 'main'))
        ]);
        
        const repoElement = createRepoElement(repo, repoData, commits);
        reposContainer.appendChild(repoElement);
    } catch (error) {
        console.error(`处理仓库 ${repo.owner}/${repo.name} 出错:`, error);
        showRepoError(repo, error);
    }
}

// 带缓存的请求
async function fetchWithCache(cacheKey, fetchFn) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                console.log(`从缓存加载: ${cacheKey}`);
                return data;
            }
        }
        
        const data = await fetchFn();
        localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        return data;
    } catch (error) {
        console.error(`缓存请求失败 (${cacheKey}):`, error);
        throw error;
    }
}

// GitHub API请求
async function fetchRepoData(owner, name) {
    const url = `https://api.github.com/repos/${owner}/${name}`;
    const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`仓库请求失败: ${response.status}`);
    }
    return await response.json();
}

async function fetchCommits(owner, name, branch) {
    const url = `https://api.github.com/repos/${owner}/${name}/commits?sha=${branch}&per_page=5`;
    const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`提交记录请求失败: ${response.status}`);
    }
    return await response.json();
}

// 创建仓库元素
function createRepoElement(repo, repoData, commits) {
    const element = document.createElement('div');
    element.className = 'repo-card';
    
    // 格式化日期
    const updatedAt = new Date(repoData.updated_at);
    const updatedAtString = updatedAt.toLocaleString();
    
    // 创建提交列表
    const commitsList = commits.map(commit => {
        const commitDate = new Date(commit.commit.author.date);
        const cleanMessage = truncate(commit.commit.message.replace(/\n/g, ' '), 60);
        
        return `
        <li class="commit">
            <a href="${commit.html_url}" target="_blank" class="commit-link">
                <span class="commit-sha">${commit.sha.substring(0, 7)}</span>
                <span class="commit-message">${cleanMessage}</span>
                <span class="commit-meta">
                    <img src="${commit.author?.avatar_url || 'https://github.com/identicons/app.png'}" 
                         alt="${commit.commit.author.name}" class="avatar">
                    <span class="author">${commit.commit.author.name}</span>
                    <span class="date">${commitDate.toLocaleDateString()}</span>
                </span>
            </a>
        </li>
        `;
    }).join('');
    
    element.innerHTML = `
        <div class="repo-header">
            <h3>
                <a href="${repoData.html_url}" target="_blank">
                    ${repo.owner}/${repo.name}
                </a>
            </h3>
            <div class="repo-meta">
                <span class="repo-updated">
                    <i class="far fa-clock"></i> 最后更新: ${updatedAtString}
                </span>
                <span class="repo-stats">
                    <span class="stars">
                        <i class="far fa-star"></i> ${repoData.stargazers_count.toLocaleString()}
                    </span>
                    <span class="forks">
                        <i class="fas fa-code-branch"></i> ${repoData.forks_count.toLocaleString()}
                    </span>
                </span>
            </div>
            <p class="repo-description">${repoData.description || '暂无描述'}</p>
        </div>
        
        <div class="repo-links">
            <a href="${repoData.html_url}" target="_blank" class="repo-link">
                <i class="fas fa-code"></i> 代码
            </a>
            <a href="${repoData.html_url}/issues" target="_blank" class="repo-link">
                <i class="fas fa-exclamation-circle"></i> Issues
            </a>
            <a href="${repoData.html_url}/pulls" target="_blank" class="repo-link">
                <i class="fas fa-code-pull-request"></i> Pull Requests
            </a>
        </div>
        
        <div class="commits-section">
            <h4><i class="fas fa-history"></i> 最近提交</h4>
            <ul class="commits-list">${commitsList}</ul>
            <a href="${repoData.html_url}/commits/${repo.branch || 'main'}" 
               target="_blank" class="view-all">
                查看所有提交 <i class="fas fa-external-link-alt"></i>
            </a>
        </div>
    `;
    
    return element;
}

// 显示/隐藏加载状态
function showLoading() {
    loadingSpinner.style.display = 'block';
    reposContainer.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
    reposContainer.style.display = 'grid';
}

// 错误处理
function showGlobalError(title, error) {
    errorContainer.style.display = 'block';
    errorContainer.innerHTML = `
        <div class="error-message">
            <h3>${title}</h3>
            <p>${error.message}</p>
            <button onclick="location.reload()" class="retry-btn">刷新页面</button>
        </div>
    `;
}

function showRepoError(repo, error) {
    const element = document.createElement('div');
    element.className = 'repo-card error';
    element.innerHTML = `
        <h3>${repo.owner}/${repo.name}</h3>
        <p>加载失败: ${error.message}</p>
        <button class="retry-btn">重试</button>
    `;
    element.querySelector('.retry-btn').addEventListener('click', () => processRepo(repo));
    reposContainer.appendChild(element);
}

// 工具函数
function truncate(str, n) {
    return (str.length > n) ? str.substring(0, n-1) + '...' : str;
}