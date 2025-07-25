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
    
    // 初始化标签页切换
    initTabs();
    
    // 加载仓库详情
    loadRepoDetails(repoName);
    
    function initTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 移除所有active类
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // 添加active类到当前标签
                tab.classList.add('active');
                const tabId = `${tab.dataset.tab}Tab`;
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    async function loadRepoDetails(repoName) {
        try {
            // 显示加载状态
            loadingDiv.style.display = 'block';
            errorMsgDiv.style.display = 'none';
            repoDetailDiv.style.display = 'none';
            
            // 检查缓存
            const cachedData = getFromCache(repoName);
            let repoData, lastCommitDate, readmeContent, contributors, releases, codeFrequency, commitActivity;
            
            if (cachedData) {
                // 使用缓存数据
                repoData = cachedData.repoData;
                lastCommitDate = cachedData.lastCommitDate;
                readmeContent = cachedData.readmeContent;
                contributors = cachedData.contributors;
                releases = cachedData.releases;
                codeFrequency = cachedData.codeFrequency;
                commitActivity = cachedData.commitActivity;
            } else {
                // 从API获取数据
                [repoData, lastCommitDate] = await fetchRepoData(repoName);
                readmeContent = await fetchReadme(repoName);
                contributors = await fetchContributors(repoName);
                releases = await fetchReleases(repoName);
                codeFrequency = await fetchCodeFrequency(repoName);
                commitActivity = await fetchCommitActivity(repoName);
                
                // 存储到缓存
                saveToCache(repoName, {
                    repoData,
                    lastCommitDate,
                    readmeContent,
                    contributors,
                    releases,
                    codeFrequency,
                    commitActivity,
                    timestamp: Date.now()
                });
            }
            
            // 渲染详情页
            renderRepoDetails(repoData, lastCommitDate, readmeContent);
            renderContributors(contributors);
            renderReleases(releases);
            renderStats(codeFrequency, commitActivity, repoData);
            
            loadingDiv.style.display = 'none';
            repoDetailDiv.style.display = 'block';
        } catch (error) {
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }
    
    // 原有的fetchRepoData和fetchReadme函数保持不变
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
    
    async function fetchContributors(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/contributors`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('获取贡献者失败:', error);
            return [];
        }
    }
    
    async function fetchReleases(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/releases`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('获取发布版本失败:', error);
            return [];
        }
    }
    
    async function fetchCodeFrequency(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/stats/code_frequency`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('获取代码频率失败:', error);
            return null;
        }
    }
    
    async function fetchCommitActivity(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/stats/commit_activity`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('获取提交活动失败:', error);
            return null;
        }
    }
    
    function renderContributors(contributors) {
        const contributorsGrid = document.getElementById('contributorsGrid');
        
        if (!contributors || contributors.length === 0) {
            contributorsGrid.innerHTML = '<p>暂无贡献者数据</p>';
            return;
        }
        
        contributorsGrid.innerHTML = contributors.map(contributor => `
            <div class="contributor-card">
                <img src="${contributor.avatar_url}" alt="${contributor.login}" class="contributor-avatar">
                <div>
                    <a href="${contributor.html_url}" target="_blank">${contributor.login}</a>
                    <p>贡献: ${contributor.contributions}</p>
                </div>
            </div>
        `).join('');
    }
    
    function renderReleases(releases) {
        const releasesList = document.getElementById('releasesList');
        
        if (!releases || releases.length === 0) {
            releasesList.innerHTML = '<p>暂无发布版本</p>';
            return;
        }
        
        releasesList.innerHTML = releases.map(release => `
            <div class="release-item">
                <h4 class="release-title">
                    <a href="${release.html_url}" target="_blank">${release.name || release.tag_name}</a>
                </h4>
                <p>${new Date(release.published_at).toLocaleDateString()}</p>
                ${release.body ? `<div class="release-body">${release.body}</div>` : ''}
            </div>
        `).join('');
    }
    
    function renderStats(codeFrequency, commitActivity, repoData) {
        const statsGrid = document.getElementById('statsGrid');
        
        // 渲染基本统计
        statsGrid.innerHTML = `
            <div class="meta-card">
                <h3>总提交数</h3>
                <p>${repoData.commits_url ? '加载中...' : '数据不可用'}</p>
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
                <h3>拉取请求</h3>
                <p>${repoData.pulls_url ? '加载中...' : '数据不可用'}</p>
            </div>
        `;
        
        // 渲染代码频率图表
        if (codeFrequency) {
            renderCodeFrequencyChart(codeFrequency);
        } else {
            document.getElementById('codeFrequencyChart').parentElement.innerHTML = 
                '<p>代码频率数据不可用</p>';
        }
        
        // 渲染提交活动图表
        if (commitActivity) {
            renderCommitActivityChart(commitActivity);
        } else {
            document.getElementById('commitActivityChart').parentElement.innerHTML = 
                '<p>提交活动数据不可用</p>';
        }
    }
    
    function renderCodeFrequencyChart(data) {
        const ctx = document.getElementById('codeFrequencyChart').getContext('2d');
        
        // 处理数据：转换为每周的净变化（添加行 - 删除行）
        const weeks = data.map(([timestamp, additions, deletions]) => ({
            date: new Date(timestamp * 1000),
            netChange: additions - deletions
        }));
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks.map(week => week.date.toLocaleDateString()),
                datasets: [{
                    label: '每周代码净变化(行)',
                    data: weeks.map(week => week.netChange),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }
    
    function renderCommitActivityChart(data) {
        const ctx = document.getElementById('commitActivityChart').getContext('2d');
        
        // 处理数据：获取最近12周的数据
        const recentWeeks = data.slice(-12);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: recentWeeks.map((week, index) => `${12 - index}周前`),
                datasets: [{
                    label: '每周提交数',
                    data: recentWeeks.map(week => week.total),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // 原有的getFromCache、saveToCache和showError函数保持不变
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
});