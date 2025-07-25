document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const loadingDiv = document.getElementById('loading');
    const errorMsgDiv = document.getElementById('errorMsg');
    const repoDetailDiv = document.getElementById('repoDetail');
    
    // 基础信息元素
    const repoAvatar = document.getElementById('repoAvatar');
    const repoLink = document.getElementById('repoLink');
    const createdDate = document.getElementById('createdDate');
    const lastUpdated = document.getElementById('lastUpdated');
    const repoDescription = document.getElementById('repoDescription');
    const repoMeta = document.getElementById('repoMeta');
    
    // 标签页内容元素
    const readmeContent = document.getElementById('readmeContent');
    const contributorsGrid = document.getElementById('contributorsGrid');
    const releasesList = document.getElementById('releasesList');
    const statsGrid = document.getElementById('statsGrid');
    const communityGrid = document.getElementById('communityGrid');
    
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
            let repoData, lastCommitDate, readmeContent, contributors, releases, 
                codeFrequency, commitActivity, communityMetrics;
            
            if (cachedData) {
                // 使用缓存数据
                repoData = cachedData.repoData;
                lastCommitDate = cachedData.lastCommitDate;
                readmeContent = cachedData.readmeContent;
                contributors = cachedData.contributors;
                releases = cachedData.releases;
                codeFrequency = cachedData.codeFrequency;
                commitActivity = cachedData.commitActivity;
                communityMetrics = cachedData.communityMetrics;
                
                console.log('使用缓存数据');
            } else {
                console.log('从API获取新数据');
                // 从API获取数据
                [repoData, lastCommitDate] = await fetchRepoData(repoName);
                readmeContent = await fetchReadme(repoName);
                contributors = await fetchContributors(repoName);
                releases = await fetchReleases(repoName);
                codeFrequency = await fetchCodeFrequency(repoName);
                commitActivity = await fetchCommitActivity(repoName);
                communityMetrics = await fetchCommunityMetrics(repoName);
                
                // 存储到缓存
                saveToCache(repoName, {
                    repoData,
                    lastCommitDate,
                    readmeContent,
                    contributors,
                    releases,
                    codeFrequency,
                    commitActivity,
                    communityMetrics,
                    timestamp: Date.now()
                });
            }
            
            // 渲染详情页
            renderBasicInfo(repoData, lastCommitDate);
            renderMetaCards(repoData);
            renderReadme(readmeContent);
            renderContributors(contributors);
            renderReleases(releases);
            renderStats(codeFrequency, commitActivity, repoData);
            renderCommunity(communityMetrics, repoData);
            
            loadingDiv.style.display = 'none';
            repoDetailDiv.style.display = 'block';
        } catch (error) {
            console.error('加载仓库详情出错:', error);
            showError(error.message);
            loadingDiv.style.display = 'none';
        }
    }
    
    function renderBasicInfo(repoData, lastCommitDate) {
        const created = new Date(repoData.created_at);
        
        repoAvatar.src = repoData.owner.avatar_url;
        repoAvatar.alt = repoData.owner.login;
        repoLink.href = repoData.html_url;
        repoLink.textContent = repoData.full_name;
        createdDate.textContent = created.toLocaleDateString();
        lastUpdated.textContent = lastCommitDate;
        repoDescription.textContent = repoData.description || '暂无描述';
    }
    
    function renderMetaCards(repoData) {
        const metaItems = [
            { icon: 'star', title: '星标数', value: repoData.stargazers_count },
            { icon: 'code-branch', title: '分支数', value: repoData.forks_count },
            { icon: 'exclamation-circle', title: '问题数', value: repoData.open_issues_count },
            { icon: 'code', title: '编程语言', value: repoData.language || '未知' },
            { icon: 'balance-scale', title: '许可证', value: repoData.license ? repoData.license.name : '无' },
            { icon: 'share-alt', title: '默认分支', value: repoData.default_branch },
            { icon: 'database', title: '仓库大小', value: `${(repoData.size / 1024).toFixed(2)} MB` },
            { icon: 'users', title: '订阅者', value: repoData.subscribers_count }
        ];
        
        repoMeta.innerHTML = metaItems.map(item => `
            <div class="meta-card">
                <h3><i class="fas fa-${item.icon}"></i> ${item.title}</h3>
                <p>${item.value.toLocaleString ? item.value.toLocaleString() : item.value}</p>
            </div>
        `).join('');
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
                return '<div class="no-data">暂无README文件</div>';
            }
            
            return await response.text();
        } catch (error) {
            console.error('获取README失败:', error);
            return '<div class="no-data">无法加载README文件</div>';
        }
    }
    
    function renderReadme(content) {
        readmeContent.innerHTML = content || '<div class="no-data">暂无README内容</div>';
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
    
    function renderContributors(contributors) {
        if (!contributors || contributors.length === 0) {
            contributorsGrid.innerHTML = '<div class="no-data">暂无贡献者数据</div>';
            return;
        }
        
        contributorsGrid.innerHTML = contributors.map(contributor => `
            <div class="contributor-card">
                <img src="${contributor.avatar_url}" alt="${contributor.login}" class="contributor-avatar">
                <div>
                    <a href="${contributor.html_url}" target="_blank">${contributor.login}</a>
                    <p>贡献: ${contributor.contributions.toLocaleString()}</p>
                </div>
            </div>
        `).join('');
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
    
    function renderReleases(releases) {
        if (!releases || releases.length === 0) {
            releasesList.innerHTML = '<div class="no-data">暂无发布版本</div>';
            return;
        }
        
        releasesList.innerHTML = releases.map(release => `
            <div class="release-item">
                <h4 class="release-title">
                    <a href="${release.html_url}" target="_blank">${release.name || release.tag_name}</a>
                    ${release.prerelease ? '<span class="badge">预发布</span>' : ''}
                    ${release.draft ? '<span class="badge">草稿</span>' : ''}
                </h4>
                <p>${new Date(release.published_at).toLocaleDateString()}</p>
                ${release.body ? `<div class="release-body">${release.body}</div>` : ''}
            </div>
        `).join('');
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
    
    async function fetchCommunityMetrics(repoName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/community/profile`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('获取社区指标失败:', error);
            return null;
        }
    }
    
    function renderStats(codeFrequency, commitActivity, repoData) {
        // 渲染基本统计
        statsGrid.innerHTML = `
            <div class="meta-card">
                <h3><i class="fas fa-code-commit"></i> 总提交数</h3>
                <p>${repoData.commits_url ? '加载中...' : '数据不可用'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-project-diagram"></i> 分支数</h3>
                <p>${repoData.forks_count.toLocaleString()}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-tasks"></i> 问题解决率</h3>
                <p>${repoData.open_issues_count ? Math.round((repoData.open_issues_count / (repoData.open_issues_count + repoData.closed_issues_count || 1)) * 100 + '%' : '数据不可用'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-code-pull-request"></i> 拉取请求</h3>
                <p>${repoData.pulls_url ? '加载中...' : '数据不可用'}</p>
            </div>
        `;
        
        // 渲染代码频率图表
        if (codeFrequency) {
            renderCodeFrequencyChart(codeFrequency);
        } else {
            document.getElementById('codeFrequencyChart').parentElement.innerHTML = 
                '<div class="no-data">代码频率数据不可用</div>';
        }
        
        // 渲染提交活动图表
        if (commitActivity) {
            renderCommitActivityChart(commitActivity);
        } else {
            document.getElementById('commitActivityChart').parentElement.innerHTML = 
                '<div class="no-data">提交活动数据不可用</div>';
        }
    }
    
    function renderCommunity(communityMetrics, repoData) {
        if (!communityMetrics) {
            communityGrid.innerHTML = '<div class="no-data">社区数据不可用</div>';
            document.getElementById('communityChart').parentElement.innerHTML = 
                '<div class="no-data">社区健康数据不可用</div>';
            return;
        }
        
        // 渲染社区健康图表
        renderCommunityChart(communityMetrics);
        
        // 渲染社区指标
        communityGrid.innerHTML = `
            <div class="meta-card">
                <h3><i class="fas fa-file-alt"></i> 文档</h3>
                <p>${communityMetrics.files.documentation ? '✓ 完善' : '✗ 缺少'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-book"></i> 行为准则</h3>
                <p>${communityMetrics.files.code_of_conduct ? '✓ 存在' : '✗ 缺少'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-gavel"></i> 贡献指南</h3>
                <p>${communityMetrics.files.contributing ? '✓ 存在' : '✗ 缺少'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-question-circle"></i> 问题模板</h3>
                <p>${communityMetrics.files.issue_template ? '✓ 存在' : '✗ 缺少'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-pull-request"></i> PR模板</h3>
                <p>${communityMetrics.files.pull_request_template ? '✓ 存在' : '✗ 缺少'}</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-comments"></i> 讨论活跃度</h3>
                <p>${communityMetrics.health_percentage}%</p>
            </div>
            <div class="meta-card">
                <h3><i class="fas fa-calendar-check"></i> 最近更新</h3>
                <p>${new Date(repoData.updated_at).toLocaleDateString()}</p>
            </div>
        `;
    }
    
    function renderCodeFrequencyChart(data) {
        const ctx = document.getElementById('codeFrequencyChart').getContext('2d');
        
        // 处理数据：转换为每周的净变化（添加行 - 删除行）
        const weeks = data.map(([timestamp, additions, deletions]) => ({
            date: new Date(timestamp * 1000),
            additions: additions,
            deletions: deletions,
            netChange: additions - deletions
        }));
        
        // 只显示最近20周的数据
        const recentWeeks = weeks.slice(-20);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: recentWeeks.map(week => week.date.toLocaleDateString()),
                datasets: [
                    {
                        label: '添加行数',
                        data: recentWeeks.map(week => week.additions),
                        borderColor: 'rgb(75, 192, 75)',
                        backgroundColor: 'rgba(75, 192, 75, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '删除行数',
                        data: recentWeeks.map(week => week.deletions),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '净变化',
                        data: recentWeeks.map(week => week.netChange),
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '最近20周代码变化趋势'
                    }
                },
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
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: recentWeeks.map((week, index) => `${12 - index}周前`),
                datasets: weekDays.map((day, dayIndex) => ({
                    label: day,
                    data: recentWeeks.map(week => week.days[dayIndex]),
                    backgroundColor: `hsl(${dayIndex * 50}, 70%, 50%)`,
                    stack: 'stack'
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '最近12周每日提交分布'
                    }
                },
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    function renderCommunityChart(communityMetrics) {
        const ctx = document.getElementById('communityChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['文档', '行为准则', '贡献指南', '问题模板', 'PR模板'],
                datasets: [{
                    data: [
                        communityMetrics.files.documentation ? 1 : 0,
                        communityMetrics.files.code_of_conduct ? 1 : 0,
                        communityMetrics.files.contributing ? 1 : 0,
                        communityMetrics.files.issue_template ? 1 : 0,
                        communityMetrics.files.pull_request_template ? 1 : 0
                    ],
                    backgroundColor: [
                        'rgb(75, 192, 192)',
                        'rgb(54, 162, 235)',
                        'rgb(153, 102, 255)',
                        'rgb(255, 159, 64)',
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '社区文件完整性'
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    function getFromCache(repoName) {
        const cacheKey = `repo_${repoName}`;
        const cachedItem = localStorage.getItem(cacheKey);
        
        if (!cachedItem) return null;
        
        try {
            const parsedData = JSON.parse(cachedItem);
            
            // 检查缓存是否过期（1小时）
            if (Date.now() - parsedData.timestamp > 60 * 60 * 1000) {
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