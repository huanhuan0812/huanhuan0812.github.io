document.addEventListener('DOMContentLoaded', function() {
    const cardsContainer = document.getElementById('cardsContainer');
    const loadingDiv = document.getElementById('loading');
    const errorMsgDiv = document.getElementById('errorMsg');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // 缓存有效期为1小时（毫秒）
    const CACHE_EXPIRY = 60 * 60 * 1000; 

    // 加载配置和仓库数据
    loadRepositories();

    // 搜索功能
    searchBtn.addEventListener('click', filterRepositories);
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            filterRepositories();
        }
    });

    async function loadRepositories() {
        try {
            // 显示加载状态
            loadingDiv.style.display = 'block';
            cardsContainer.innerHTML = '';
            errorMsgDiv.style.display = 'none';

            // 加载配置文件
            const configResponse = await fetch('config.json');
            if (!configResponse.ok) throw new Error('无法加载配置文件');
            const config = await configResponse.json();

            // 为每个仓库创建卡片
            const promises = config.repositories.map(repo => createRepoCard(repo));
            await Promise.all(promises);

            loadingDiv.style.display = 'none';
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }

    async function createRepoCard(repoConfig) {
        try {
            const repoName = repoConfig.name;
            
            // 检查本地缓存
            const cachedData = getFromCache(repoName);
            let repoData, lastCommitDate;

            if (cachedData) {
                // 使用缓存数据
                repoData = cachedData.repoData;
                lastCommitDate = cachedData.lastCommitDate;
            } else {
                // 从API获取数据
                [repoData, lastCommitDate] = await fetchRepoData(repoName);
                
                // 存储到缓存
                saveToCache(repoName, {
                    repoData,
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
                    <img src="${repoData.owner.avatar_url}" alt="${repoData.owner.login}" class="card-avatar">
                    <h3 class="card-title">${repoData.full_name}</h3>
                </div>
                <p class="card-description">${repoConfig.description || repoData.description || '暂无描述'}</p>
                <div class="card-meta">
                    <div class="meta-item">
                        <i class="fas fa-star"></i>
                        <span>${repoData.stargazers_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-code-branch"></i>
                        <span>${repoData.forks_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${repoData.open_issues_count.toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-code"></i>
                        <span>${repoData.language || '未知'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${lastCommitDate}</span>
                    </div>
                </div>
            `;

            // 添加点击事件
            card.addEventListener('click', () => {
                window.open(repoData.html_url, '_blank');
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
            console.error(`创建仓库卡片 ${repoConfig.name} 时出错:`, error);
        }
    }

    async function fetchRepoData(repoName) {
        try {
            // 获取仓库基本信息
            const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`);
            if (!repoResponse.ok) throw new Error(`无法获取仓库 ${repoName} 的信息`);
            const repoData = await repoResponse.json();

            // 获取最新提交信息
            let lastCommitDate = '未知';
            const commitsResponse = await fetch(`https://api.github.com/repos/${repoName}/commits`);
            if (commitsResponse.ok) {
                const commitsData = await commitsResponse.json();
                if (commitsData.length > 0) {
                    const date = new Date(commitsData[0].commit.author.date);
                    lastCommitDate = date.toLocaleDateString();
                }
            }

            return [repoData, lastCommitDate];
        } catch (error) {
            console.error(`获取仓库数据 ${repoName} 时出错:`, error);
            throw error;
        }
    }

    function getFromCache(repoName) {
        const cacheKey = `repo_${repoName}`;
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
        const cacheKey = `repo_${repoName}`;
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
            // 如果本地存储已满，清空缓存
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
        errorMsgDiv.textContent = message;
        errorMsgDiv.style.display = 'block';
    }
});