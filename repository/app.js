document.addEventListener('DOMContentLoaded', function() {
    const cardsContainer = document.getElementById('cardsContainer');
    const loadingDiv = document.getElementById('loading');
    const errorMsgDiv = document.getElementById('errorMsg');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // 缓存有效期为1小时（毫秒）
    const CACHE_EXPIRY = 60 * 60 * 1000;
    
    // GitHub用户名（请修改为你的用户名）
    const GITHUB_USERNAME = 'huanhuan0812'; // 修改为你的GitHub用户名

    // 加载所有仓库
    loadAllRepositories();

    // 搜索功能
    searchBtn.addEventListener('click', filterRepositories);
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            filterRepositories();
        }
    });

    async function loadAllRepositories() {
        try {
            // 显示加载状态
            loadingDiv.style.display = 'block';
            cardsContainer.innerHTML = '';
            errorMsgDiv.style.display = 'none';

            // 获取所有仓库（包括分页）
            const allRepos = await fetchAllRepositories();
            
            // 为每个仓库创建卡片
            for (const repo of allRepos) {
                await createRepoCard(repo);
            }

            loadingDiv.style.display = 'none';
            
            if (allRepos.length === 0) {
                showError('没有找到任何仓库');
            }
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }

    async function fetchAllRepositories() {
        let page = 1;
        let allRepos = [];
        let hasMore = true;
        
        // 检查缓存
        const cachedRepos = getReposListFromCache();
        if (cachedRepos) {
            return cachedRepos;
        }

        while (hasMore) {
            try {
                const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?page=${page}&per_page=100&sort=updated`);
                
                if (!response.ok) {
                    throw new Error(`GitHub API 错误: ${response.status}`);
                }
                
                const repos = await response.json();
                
                if (repos.length === 0) {
                    hasMore = false;
                } else {
                    allRepos = [...allRepos, ...repos];
                    page++;
                    
                    // 如果返回的仓库数少于100，说明是最后一页
                    if (repos.length < 100) {
                        hasMore = false;
                    }
                }
                
                // 添加小延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error('获取仓库列表失败:', error);
                throw error;
            }
        }
        
        // 缓存仓库列表
        saveReposListToCache(allRepos);
        
        return allRepos;
    }

    async function createRepoCard(repo) {
        try {
            const repoName = repo.full_name;
            
            // 检查单个仓库缓存
            const cachedData = getFromCache(repoName);
            let lastCommitDate;

            if (cachedData) {
                lastCommitDate = cachedData.lastCommitDate;
            } else {
                // 获取最新提交信息
                lastCommitDate = await fetchLastCommitDate(repoName);
                
                // 存储到缓存
                saveToCache(repoName, {
                    lastCommitDate,
                    timestamp: Date.now()
                });
            }

            // 创建卡片元素
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.repo = repoName;
            card.innerHTML = `
                <div class="card-header">
                    <img src="${repo.owner.avatar_url}" alt="${repo.owner.login}" class="card-avatar">
                    <h3 class="card-title">${repo.full_name}</h3>
                </div>
                <p class="card-description">${repo.description || '暂无描述'}</p>
                <div class="card-meta">
                    <div class="meta-item">
                        <i class="fas fa-star"></i>
                        <span>${repo.stargazers_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-code-branch"></i>
                        <span>${repo.forks_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${repo.open_issues_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-code"></i>
                        <span>${repo.language || '未知'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${lastCommitDate}</span>
                    </div>
                </div>
            `;

            // 添加点击事件 - 跳转到详情页
            card.addEventListener('click', () => {
                window.location.href = `details.html?repo=${encodeURIComponent(repoName)}`;
            });

            // 添加悬停效果
            card.addEventListener('mouseenter', () => {
                card.style.transition = 'all 0.3s ease';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transition = 'all 0.3s ease';
            });

            cardsContainer.appendChild(card);
        } catch (error) {
            console.error(`创建仓库卡片 ${repo.name} 时出错:`, error);
        }
    }

    async function fetchLastCommitDate(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/commits?per_page=1`);
            if (response.ok) {
                const commitsData = await response.json();
                if (commitsData.length > 0) {
                    const date = new Date(commitsData[0].commit.author.date);
                    return date.toLocaleDateString();
                }
            }
            return '未知';
        } catch (error) {
            console.error(`获取提交日期失败 ${repoName}:`, error);
            return '未知';
        }
    }

    // 缓存仓库列表
    function getReposListFromCache() {
        const cacheKey = `user_repos_${GITHUB_USERNAME}`;
        const cachedItem = localStorage.getItem(cacheKey);
        
        if (!cachedItem) return null;
        
        try {
            const parsedData = JSON.parse(cachedItem);
            
            // 检查缓存是否过期
            if (Date.now() - parsedData.timestamp > CACHE_EXPIRY) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            
            return parsedData.repos;
        } catch (e) {
            localStorage.removeItem(cacheKey);
            return null;
        }
    }

    function saveReposListToCache(repos) {
        const cacheKey = `user_repos_${GITHUB_USERNAME}`;
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                repos: repos,
                timestamp: Date.now()
            }));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                localStorage.clear();
                console.warn('本地存储已满，已清空缓存');
            }
        }
    }

    function getFromCache(repoName) {
        const cacheKey = `repo_commits_${repoName}`;
        const cachedItem = localStorage.getItem(cacheKey);
        
        if (!cachedItem) return null;
        
        try {
            const parsedData = JSON.parse(cachedItem);
            
            // 检查缓存是否过期
            if (Date.now() - parsedData.timestamp > CACHE_EXPIRY) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            
            return parsedData;
        } catch (e) {
            localStorage.removeItem(cacheKey);
            return null;
        }
    }

    function saveToCache(repoName, data) {
        const cacheKey = `repo_commits_${repoName}`;
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                localStorage.clear();
                console.warn('本地存储已满，已清空缓存');
            }
        }
    }

    function filterRepositories() {
        const searchTerm = searchInput.value.toLowerCase();
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            const repoName = card.dataset.repo.toLowerCase();
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const description = card.querySelector('.card-description').textContent.toLowerCase();
            
            if (repoName.includes(searchTerm) || title.includes(searchTerm) || description.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    function showError(message) {
        errorMsgDiv.textContent = `错误: ${message}`;
        errorMsgDiv.style.display = 'block';
    }
});
