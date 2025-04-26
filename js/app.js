document.addEventListener('DOMContentLoaded', async function() {
    // 加载配置文件
    const config = await fetch('_config.yml').then(response => response.text());

    // 简单的 YAML 解析（生产环境建议使用 js-yaml 库）
    const repos = parseYaml(config);

    // 获取容器元素
    const reposContainer = document.getElementById('repos-container');

    // 为每个仓库获取并显示信息
    for (const repo of repos.repositories) {
        try {
            const [repoData, commits] = await Promise.all([
                fetchRepoData(repo.owner, repo.name),
                fetchCommits(repo.owner, repo.name, repo.branch || 'main')
            ]);

            const repoElement = createRepoElement(repo, repoData, commits);
            reposContainer.appendChild(repoElement);
        } catch (error) {
            console.error(`Error fetching data for ${repo.owner}/${repo.name}:`, error);
            const errorElement = document.createElement('div');
            errorElement.className = 'repo-card error';
            errorElement.innerHTML = `
                <h3>${repo.owner}/${repo.name}</h3>
                <p>无法加载仓库信息</p>
            `;
            reposContainer.appendChild(errorElement);
        }
    }
});

// 简单的 YAML 解析函数
function parseYaml(yamlText) {
    const lines = yamlText.split('\n').filter(line => line.trim() !== '');
    const result = { repositories: [] };
    let currentRepo = null;

    for (const line of lines) {
        if (line.startsWith('repositories:')) continue;

        if (line.trim().startsWith('-')) {
            if (currentRepo) result.repositories.push(currentRepo);
            currentRepo = {};
        } else if (currentRepo) {
            const [key, value] = line.split(':').map(part => part.trim());
            currentRepo[key] = value;
        }
    }

    if (currentRepo) result.repositories.push(currentRepo);
    return result;
}

// 从 GitHub API 获取仓库基本信息
async function fetchRepoData(owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!response.ok) {
        throw new Error(`GitHub API 请求失败: ${response.status}`);
    }
    return await response.json();
}

// 从 GitHub API 获取提交信息
async function fetchCommits(owner, repo, branch) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=5`);
    if (!response.ok) {
        throw new Error(`GitHub API 请求失败: ${response.status}`);
    }
    return await response.json();
}

// 创建仓库卡片元素
function createRepoElement(repo, repoData, commits) {
    const repoElement = document.createElement('div');
    repoElement.className = 'repo-card';

    // 格式化更新时间
    const updatedAt = new Date(repoData.updated_at);
    const updatedAtString = updatedAt.toLocaleString();

    // 创建星标和fork数量显示
    const starsCount = repoData.stargazers_count.toLocaleString();
    const forksCount = repoData.forks_count.toLocaleString();

    // 创建提交列表
    const commitsList = commits.map(commit => {
        const commitDate = new Date(commit.commit.author.date);
        return `
        <li class="commit">
            <a href="${commit.html_url}" target="_blank" class="commit-link">
                <span class="commit-sha">${commit.sha.substring(0, 7)}</span>
                <span class="commit-message">${truncate(commit.commit.message, 60)}</span>
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

    repoElement.innerHTML = `
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
                        <i class="far fa-star"></i> ${starsCount}
                    </span>
                    <span class="forks">
                        <i class="fas fa-code-branch"></i> ${forksCount}
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
            <a href="${repoData.html_url}/actions" target="_blank" class="repo-link">
                <i class="fas fa-play-circle"></i> Actions
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

    return repoElement;
}

// 截断字符串
function truncate(str, n) {
    return (str.length > n) ? str.substring(0, n-1) + '...' : str;
}