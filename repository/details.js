document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const errorMsgDiv = document.getElementById('errorMsg');
    const repoDetailDiv = document.getElementById('repoDetail');
    
    // 从URL参数获取仓库名称
    const urlParams = new URLSearchParams(window.location.search);
    const repoName = urlParams.get('repo');
    
    if (!repoName) {
        showError('未指定仓库名称');
        return;
    }
    
    // 加载仓库详情
    loadRepoDetails(repoName);
    
    async function loadRepoDetails(repoName) {
        try {
            // 显示加载状态
            loadingDiv.style.display = 'block';
            errorMsgDiv.style.display = 'none';
            repoDetailDiv.style.display = 'none';
            
            // 检查缓存
            const cachedData = getFromCache(repoName);
            let repoData, lastCommitDate, readmeContent;
            
            if (cachedData) {
                // 使用缓存数据
                repoData = cachedData.repoData;
                lastCommitDate = cachedData.lastCommitDate;
                readmeContent = cachedData.readmeContent;
            } else {
                // 从API获取数据
                [repoData, lastCommitDate] = await fetchRepoData(repoName);
                readmeContent = await fetchReadme(repoName);
                
                // 存储到缓存
                saveToCache(repoName, {
                    repoData,
                    lastCommitDate,
                    readmeContent,
                    timestamp: Date.now()
                });
            }
            
            // 渲染详情页
            renderRepoDetails(repoData, lastCommitDate, readmeContent);
            
            loadingDiv.style.display = 'none';
            repoDetailDiv.style.display = 'block';
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
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
    
    async function fetchReadme(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/readme`, {
                headers: {
                    'Accept': 'application/vnd.github.v3.html'
                }
            });
            
            if (!response.ok) {
                return '<p>暂无README文件</p>';
            }
            
            return await response.text();
        } catch (error) {
            console.error('获取README失败:', error);
            return '<p>无法加载README文件</p>';
        }
    }
    
    function renderRepoDetails(repoData, lastCommitDate, readmeContent) {
        const date = new Date(repoData.created_at);
        const createdDate = date.toLocaleDateString();
        
        repoDetailDiv.innerHTML = `
            <div class="repo-header">
                <img src="${repoData.owner.avatar_url}" alt="${repoData.owner.login}" class="repo-avatar">
                <div>
                    <h1 class="repo-title">
                        <a href="${repoData.html_url}" target="_blank">${repoData.full_name}</a>
                    </h1>
                    <p>创建于: ${createdDate} | 最后更新: ${lastCommitDate}</p>
                </div>
            </div>
            
            <p class="repo-description">${repoData.description || '暂无描述'}</p>
            
            <div class="repo-meta">
                <div class="meta-card">
                    <h3>星标数</h3>
                    <p>${repoData.stargazers_count.toLocaleString()}</p>
                </div>
                <div class="meta-card">
                    <h3>分支数</h3>
                    <p>${repoData.forks_count.toLocaleString()}</p>
                </div>
                <div class="meta-card">
                    <h3>问题数</h3>
                    <p>${repoData.open_issues_count.toLocaleString()}</p>
                </div>
                <div class="meta-card">
                    <h3>编程语言</h3>
                    <p>${repoData.language || '未知'}</p>
                </div>
                <div class="meta-card">
                    <h3>许可证</h3>
                    <p>${repoData.license ? repoData.license.name : '无'}</p>
                </div>
                <div class="meta-card">
                    <h3>默认分支</h3>
                    <p>${repoData.default_branch}</p>
                </div>
                <div class="meta-card">
                    <h3>仓库大小</h3>
                    <p>${(repoData.size / 1024).toFixed(2)} MB</p>
                </div>
                <div class="meta-card">
                    <h3>订阅者</h3>
                    <p>${repoData.subscribers_count.toLocaleString()}</p>
                </div>
            </div>
            
            <h2 class="section-title">关于</h2>
            <div class="readme-content" id="readmeContent">
                ${readmeContent}
            </div>
        `;
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
    
    function showError(message) {
        errorMsgDiv.textContent = message;
        errorMsgDiv.style.display = 'block';
    }
});