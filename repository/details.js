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
    
    // 加载缓存
    loadCacheFromStorage();
    
    // 加载仓库详情
    loadRepoDetails(repoName);
    
    function loadCacheFromStorage() {
        const keys = ['repoData', 'branches', 'tags', 'commits', 'releases', 'issues'];
        keys.forEach(key => {
            const data = localStorage.getItem(`${key}_${repoName}`);
            const lastUpdated = localStorage.getItem(`${key}_${repoName}_lastUpdated`);
            if (data && lastUpdated) {
                cache[key][repoName] = JSON.parse(data);
                cache.lastUpdated[key] = parseInt(lastUpdated);
            }
        });
    }
    
    function isCacheValid(key) {
        return cache[key][repoName] && cache.lastUpdated[key] && (Date.now() - cache.lastUpdated[key] < CACHE_EXPIRY);
    }
    
    async function cachedFetch(url, cacheKey) {
        // 检查内存缓存
        if (isCacheValid(cacheKey)) {
            console.log(`Using cached data for ${cacheKey}`);
            showCacheStatus();
            return cache[cacheKey][repoName];
        }
    
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            // 更新缓存
            cache[cacheKey][repoName] = data;
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
        status.textContent = 'Using cached data';
        document.body.appendChild(status);
        
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 500);
        }, 2000);
    }
    
    function addRefreshButton() {
        const header = document.querySelector('.repo-header');
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.onclick = () => {
            Object.keys(cache).forEach(key => delete cache[key][repoName]);
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
            
            // 获取额外数据
            fetchAdditionalRepoDetails(repoName);
            
            loadingDiv.style.display = 'none';
            repoDetailDiv.style.display = 'block';
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }
    
    async function fetchAdditionalRepoDetails(repoName) {
        try {
            // 设置基本信息
            const [owner, repo] = repoName.split('/');
            document.getElementById('repo-name').querySelector('span').textContent = repo;
            
            // 设置链接
            document.getElementById('repo-url').href = `https://github.com/${repoName}`;
            document.getElementById('releases-url').href = `https://github.com/${repoName}/releases`;
            document.getElementById('issues-url').href = `https://github.com/${repoName}/issues`;
            document.getElementById('pulls-url').href = `https://github.com/${repoName}/pulls`;
            
            // 获取额外数据
            fetchBranches(repoName);
            fetchCommits(repoName);
            fetchReleases(repoName);
            fetchIssues(repoName);
            fetchTags(repoName);
            
            // 添加刷新按钮
            addRefreshButton();
            
            // 设置标签页
            setupTabs();
        } catch (error) {
            console.error('Error fetching additional repo details:', error);
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
        
        document.getElementById('repo-avatar').src = repoData.owner.avatar_url;
        document.getElementById('repo-avatar').alt = repoData.owner.login;
        document.getElementById('repo-name').textContent = repoData.full_name;
        document.getElementById('repo-url').href = repoData.html_url;
        document.getElementById('repo-description').textContent = repoData.description || '暂无描述';
        document.getElementById('stargazers-count').textContent = repoData.stargazers_count.toLocaleString();
        document.getElementById('watchers-count').textContent = repoData.subscribers_count.toLocaleString();
        document.getElementById('forks-count').textContent = repoData.forks_count.toLocaleString();
        document.getElementById('open-issues').textContent = repoData.open_issues_count.toLocaleString();
        
        const metaContainer = document.getElementById('repo-meta');
        metaContainer.innerHTML = `
            <span class="repo-meta-item"><i class="fas fa-code"></i> ${repoData.language || '未知'}</span>
            <span class="repo-meta-item"><i class="fas fa-calendar-alt"></i> ${createdDate}</span>
            <span class="repo-meta-item"><i class="fas fa-sync-alt"></i> ${lastCommitDate}</span>
        `;
        
        document.getElementById('readmeContent').innerHTML = readmeContent;
    }
    
    let currentPage = 1;
    async function fetchBranches(repoName) {
        const cacheKey = 'branches';
        
        try {
            const branches = await cachedFetch(`https://api.github.com/repos/${repoName}/branches`, cacheKey);
            const branchSelector = document.getElementById('branch-selector');
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
                currentPage = 1;
                fetchCommits(repoName, branchSelector.value);
            });
            
        } catch (error) {
            console.error('Error fetching branches:', error);
            document.getElementById('branch-selector').innerHTML = '<option value="">Failed to load branches</option>';
        }
    }
    
    async function fetchTags(repoName) {
        const cacheKey = 'tags';
        
        try {
            const tags = await cachedFetch(`https://api.github.com/repos/${repoName}/tags`, cacheKey);
            const tagsList = document.getElementById('tags-list');
            
            if (tags.length === 0) {
                tagsList.innerHTML = '<p>No tags found</p>';
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
                moreLink.textContent = `+${tags.length - 10} more`;
                tagsList.appendChild(moreLink);
            }
            
        } catch (error) {
            console.error('Error fetching tags:', error);
            document.getElementById('tags-list').innerHTML = '<p>Failed to load tags</p>';
        }
    }
    
    async function fetchCommits(repoName, branch = 'main') {
        const cacheKey = 'commits';
        
        try {
            const commits = await cachedFetch(
                `https://api.github.com/repos/${repoName}/commits?sha=${branch}&page=${currentPage}&per_page=10`,
                cacheKey
            );
            
            const commitsList = document.getElementById('commits-list');
            if (currentPage === 1) commitsList.innerHTML = '';
            
            if (commits.length === 0) {
                if (currentPage === 1) commitsList.innerHTML = '<p>No commits found</p>';
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
                        <a href="${commit.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
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
            console.error('Error fetching commits:', error);
            document.getElementById('commits-list').innerHTML = '<p>Failed to load commits</p>';
        }
    }
    
    async function fetchReleases(repoName) {
        const cacheKey = 'releases';
        
        try {
            const releases = await cachedFetch(
                `https://api.github.com/repos/${repoName}/releases?per_page=5`,
                cacheKey
            );
            
            const releasesList = document.getElementById('releases-list');
            releasesList.innerHTML = releases.length === 0 ? '<p>No releases found</p>' : '';
            
            releases.forEach(release => {
                const releaseItem = document.createElement('div');
                releaseItem.className = 'release-item';
                const date = new Date(release.published_at);
                
                releaseItem.innerHTML = `
                    <h4>${release.name || release.tag_name}</h4>
                    <div class="release-meta">
                        <span><i class="fas fa-tag"></i> ${release.tag_name}</span>
                        <span><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
                        <a href="${release.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
                    </div>
                    ${release.body ? `<div class="release-body">${marked.parse(release.body)}</div>` : ''}
                `;
                releasesList.appendChild(releaseItem);
            });
            
        } catch (error) {
            console.error('Error fetching releases:', error);
            document.getElementById('releases-list').innerHTML = '<p>Failed to load releases</p>';
        }
    }
    
    async function fetchIssues(repoName) {
        const cacheKey = 'issues';
        
        try {
            const issues = await cachedFetch(
                `https://api.github.com/repos/${repoName}/issues?per_page=5`,
                cacheKey
            );
            
            const issuesList = document.getElementById('issues-list');
            issuesList.innerHTML = issues.length === 0 ? '<p>No recent issues found</p>' : '';
            
            issues.forEach(issue => {
                const issueItem = document.createElement('div');
                issueItem.className = 'issue-item';
                const date = new Date(issue.created_at);
                
                issueItem.innerHTML = `
                    <h4>${issue.title}</h4>
                    <div class="issue-meta">
                        <span><i class="fas fa-user"></i> ${issue.user.login}</span>
                        <span><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
                        <span><i class="fas fa-comment"></i> ${issue.comments} comments</span>
                        <a href="${issue.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
                    </div>
                    ${issue.body ? `<div class="issue-body">${marked.parse(issue.body.substring(0, 200))}...</div>` : ''}
                `;
                issuesList.appendChild(issueItem);
            });
            
        } catch (error) {
            console.error('Error fetching issues:', error);
            document.getElementById('issues-list').innerHTML = '<p>Failed to load issues</p>';
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