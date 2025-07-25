// details.js
document.addEventListener('DOMContentLoaded', function() {
    const loadingDiv = document.getElementById('loading');
    const errorMsgDiv = document.getElementById('errorMsg');
    const repoDetailDiv = document.getElementById('repoDetail');
    const tabsContainer = document.getElementById('tabsContainer');
    
    // 缓存系统
    const cache = {
        repoData: {},
        branches: {},
        tags: {},
        commits: {},
        releases: {},
        issues: {},
        lastUpdated: {}
    };
    
    const CACHE_EXPIRY = 60 * 60 * 1000; // 1小时缓存
    
    // 从URL参数获取仓库名称
    const urlParams = new URLSearchParams(window.location.search);
    const repoName = urlParams.get('repo');
    
    if (!repoName) {
        showError('未指定仓库名称');
        return;
    }
    
    // 初始化加载缓存
    loadCacheFromStorage();
    // 加载仓库详情
    loadRepoDetails(repoName);
    // 添加刷新按钮
    addRefreshButton();
    
    function loadCacheFromStorage() {
        const keys = ['repoData', 'branches', 'tags', 'commits', 'releases', 'issues'];
        keys.forEach(key => {
            const data = localStorage.getItem(`${key}_${repoName}`);
            const lastUpdated = localStorage.getItem(`${key}_${repoName}_lastUpdated`);
            if (data && lastUpdated) {
                cache[key] = JSON.parse(data);
                cache.lastUpdated[key] = parseInt(lastUpdated);
            }
        });
    }
    
    function isCacheValid(key) {
        return cache[key] && cache.lastUpdated[key] && (Date.now() - cache.lastUpdated[key] < CACHE_EXPIRY);
    }
    
    async function cachedFetch(url, cacheKey) {
        // 检查内存缓存
        if (isCacheValid(cacheKey)) {
            console.log(`Using cached data for ${cacheKey}`);
            showCacheStatus();
            return cache[cacheKey];
        }
    
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            // 更新缓存
            cache[cacheKey] = data;
            cache.lastUpdated[cacheKey] = Date.now();
            localStorage.setItem(`${cacheKey}_${repoName}`, JSON.stringify(data));
            localStorage.setItem(`${cacheKey}_${repoName}_lastUpdated`, Date.now());
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${cacheKey}:`, error);
            // 尝试使用localStorage缓存
            const storedData = localStorage.getItem(`${cacheKey}_${repoName}`);
            if (storedData) {
                console.log(`Falling back to localStorage for ${cacheKey}`);
                return JSON.parse(storedData);
            }
            throw error;
        }
    }
    
    function showCacheStatus() {
        const existingStatus = document.querySelector('.cache-status');
        if (existingStatus) existingStatus.remove();
    
        const status = document.createElement('div');
        status.className = 'cache-status';
        status.textContent = '使用缓存数据';
        document.body.appendChild(status);
        
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 500);
        }, 2000);
    }
    
    function addRefreshButton() {
        const header = document.querySelector('.repo-header');
        if (!header) return;
        
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.onclick = () => {
            Object.keys(cache).forEach(key => delete cache[key]);
            localStorage.clear();
            location.reload();
        };
        header.appendChild(refreshBtn);
    }
    
    async function loadRepoDetails(repoName) {
        try {
            // 显示加载状态
            loadingDiv.style.display = 'block';
            errorMsgDiv.style.display = 'none';
            repoDetailDiv.style.display = 'none';
            
            // 获取仓库数据
            const [repoData, lastCommitDate] = await fetchRepoData(repoName);
            const readmeContent = await fetchReadme(repoName);
            
            // 渲染详情页
            renderRepoDetails(repoData, lastCommitDate, readmeContent);
            
            // 加载其他数据
            fetchBranches(repoName);
            fetchCommits(repoName);
            fetchReleases(repoName);
            fetchIssues(repoName);
            fetchTags(repoName);
            
            loadingDiv.style.display = 'none';
            repoDetailDiv.style.display = 'block';
            tabsContainer.style.display = 'block';
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }
    
    async function fetchRepoData(repoName) {
        try {
            // 获取仓库基本信息
            const repoData = await cachedFetch(`https://api.github.com/repos/${repoName}`, 'repoData');
            
            // 获取最新提交信息
            let lastCommitDate = '未知';
            const commitsData = await cachedFetch(`https://api.github.com/repos/${repoName}/commits`, 'commits');
            if (commitsData.length > 0) {
                const date = new Date(commitsData[0].commit.author.date);
                lastCommitDate = date.toLocaleDateString();
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
    
    async function fetchBranches(repoName) {
        try {
            const branches = await cachedFetch(`https://api.github.com/repos/${repoName}/branches`, 'branches');
            const branchSelector = document.getElementById('branch-selector');
            if (!branchSelector) return;
            
            branchSelector.innerHTML = '';
            
            branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.name;
                option.textContent = branch.name;
                branchSelector.appendChild(option);
            });
            
            const defaultBranch = branches.find(b => b.name === 'main' || b.name === 'master');
            if (defaultBranch) branchSelector.value = defaultBranch.name;
            
            branchSelector.addEventListener('change', () => {
                fetchCommits(repoName, branchSelector.value);
            });
            
        } catch (error) {
            console.error('获取分支失败:', error);
            const branchSelector = document.getElementById('branch-selector');
            if (branchSelector) {
                branchSelector.innerHTML = '<option value="">获取分支失败</option>';
            }
        }
    }
    
    let currentPage = 1;
    async function fetchCommits(repoName, branch = 'main') {
        try {
            const commits = await cachedFetch(
                `https://api.github.com/repos/${repoName}/commits?sha=${branch}&page=${currentPage}&per_page=10`,
                `commits_${branch}_${currentPage}`
            );
            
            const commitsList = document.getElementById('commits-list');
            if (currentPage === 1) commitsList.innerHTML = '';
            
            if (commits.length === 0) {
                if (currentPage === 1) commitsList.innerHTML = '<p>暂无提交记录</p>';
                document.getElementById('load-more-commits').style.display = 'none';
                return;
            }
            
            commits.forEach(commit => {
                const commitItem = document.createElement('div');
                commitItem.className = 'commit-item';
                const message = commit.commit.message.split('\n')[0];
                const date = new Date(commit.commit.author.date);
                
                commitItem.innerHTML = `
                    <div class="commit-message">${message}</div>
                    <div class="commit-meta">
                        <span><i class="fas fa-user"></i> ${commit.commit.author.name}</span>
                        <span><i class="far fa-calendar-alt"></i> ${date.toLocaleString()}</span>
                        <a href="${commit.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> 查看</a>
                    </div>
                `;
                commitsList.appendChild(commitItem);
            });
            
            document.getElementById('load-more-commits').style.display = 'block';
            document.getElementById('load-more-commits').onclick = () => {
                currentPage++;
                fetchCommits(repoName, branch);
            };
            
        } catch (error) {
            console.error('获取提交记录失败:', error);
            document.getElementById('commits-list').innerHTML = '<p>获取提交记录失败</p>';
        }
    }
    
    async function fetchTags(repoName) {
        try {
            const tags = await cachedFetch(`https://api.github.com/repos/${repoName}/tags`, 'tags');
            const tagsList = document.getElementById('tags-list');
            
            if (tags.length === 0) {
                tagsList.innerHTML = '<p>暂无标签</p>';
                return;
            }
            
            tagsList.innerHTML = '';
            tags.slice(0, 10).forEach(tag => {
                const tagElement = document.createElement('a');
                tagElement.className = 'tag';
                tagElement.href = `https://github.com/${repoName}/releases/tag/${tag.name}`;
                tagElement.target = '_blank';
                tagElement.title = tag.name;
                tagElement.innerHTML = `<i class="fas fa-tag"></i><span>${tag.name}</span>`;
                tagsList.appendChild(tagElement);
            });
            
            if (tags.length > 10) {
                const moreLink = document.createElement('a');
                moreLink.className = 'tag';
                moreLink.href = `https://github.com/${repoName}/tags`;
                moreLink.target = '_blank';
                moreLink.textContent = `+${tags.length - 10} 更多`;
                tagsList.appendChild(moreLink);
            }
            
        } catch (error) {
            console.error('获取标签失败:', error);
            document.getElementById('tags-list').innerHTML = '<p>获取标签失败</p>';
        }
    }
    
    async function fetchReleases(repoName) {
        try {
            const releases = await cachedFetch(
                `https://api.github.com/repos/${repoName}/releases?per_page=5`,
                'releases'
            );
            
            const releasesList = document.getElementById('releases-list');
            releasesList.innerHTML = releases.length === 0 ? '<p>暂无发布版本</p>' : '';
            
            releases.forEach(release => {
                const releaseItem = document.createElement('div');
                releaseItem.className = 'release-item';
                const date = new Date(release.published_at);
                
                releaseItem.innerHTML = `
                    <h4>${release.name || release.tag_name}</h4>
                    <div class="release-meta">
                        <span><i class="fas fa-tag"></i> ${release.tag_name}</span>
                        <span><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
                        <a href="${release.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> 查看</a>
                    </div>
                    ${release.body ? `<div class="release-body">${release.body}</div>` : ''}
                `;
                releasesList.appendChild(releaseItem);
            });
            
        } catch (error) {
            console.error('获取发布版本失败:', error);
            document.getElementById('releases-list').innerHTML = '<p>获取发布版本失败</p>';
        }
    }
    
    async function fetchIssues(repoName) {
        try {
            const issues = await cachedFetch(
                `https://api.github.com/repos/${repoName}/issues?per_page=5`,
                'issues'
            );
            
            const issuesList = document.getElementById('issues-list');
            issuesList.innerHTML = issues.length === 0 ? '<p>暂无问题</p>' : '';
            
            issues.forEach(issue => {
                const issueItem = document.createElement('div');
                issueItem.className = 'issue-item';
                const date = new Date(issue.created_at);
                
                issueItem.innerHTML = `
                    <h4>${issue.title}</h4>
                    <div class="issue-meta">
                        <span><i class="fas fa-user"></i> ${issue.user.login}</span>
                        <span><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
                        <span><i class="fas fa-comment"></i> ${issue.comments} 评论</span>
                        <a href="${issue.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> 查看</a>
                    </div>
                    ${issue.body ? `<div class="issue-body">${issue.body.substring(0, 200)}...</div>` : ''}
                `;
                issuesList.appendChild(issueItem);
            });
            
        } catch (error) {
            console.error('获取问题失败:', error);
            document.getElementById('issues-list').innerHTML = '<p>获取问题失败</p>';
        }
    }
    
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
            });
        });
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
            
            <div id="tabsContainer" style="display: none;">
                <div class="tabs">
                    <button class="tab-button active" data-tab="readme">README</button>
                    <button class="tab-button" data-tab="commits">提交记录</button>
                    <button class="tab-button" data-tab="branches">分支</button>
                    <button class="tab-button" data-tab="tags">标签</button>
                    <button class="tab-button" data-tab="releases">发布版本</button>
                    <button class="tab-button" data-tab="issues">问题</button>
                </div>
                
                <div class="tab-content active" id="readme-tab">
                    <h2 class="section-title">关于</h2>
                    <div class="readme-content">
                        ${readmeContent}
                    </div>
                </div>
                
                <div class="tab-content" id="commits-tab">
                    <h2 class="section-title">提交记录</h2>
                    <div class="commits-controls">
                        <select id="branch-selector" class="branch-selector">
                            <option value="">加载分支...</option>
                        </select>
                        <button id="load-more-commits" class="load-more">加载更多</button>
                    </div>
                    <div id="commits-list" class="commits-list"></div>
                </div>
                
                <div class="tab-content" id="branches-tab">
                    <h2 class="section-title">分支</h2>
                    <div id="branches-list" class="branches-list"></div>
                </div>
                
                <div class="tab-content" id="tags-tab">
                    <h2 class="section-title">标签</h2>
                    <div id="tags-list" class="tags-list"></div>
                </div>
                
                <div class="tab-content" id="releases-tab">
                    <h2 class="section-title">发布版本</h2>
                    <div id="releases-list" class="releases-list"></div>
                </div>
                
                <div class="tab-content" id="issues-tab">
                    <h2 class="section-title">问题</h2>
                    <div id="issues-list" class="issues-list"></div>
                </div>
            </div>
        `;
        
        // 初始化标签页
        setupTabs();
    }
    
    function showError(message) {
        errorMsgDiv.textContent = message;
        errorMsgDiv.style.display = 'block';
    }
});