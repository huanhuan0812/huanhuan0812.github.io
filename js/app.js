document.addEventListener('DOMContentLoaded', async function() {
    // 加载配置文件
    const config = await fetch('_config.yml').then(response => response.text());

    // 简单的 YAML 解析（生产环境建议使用 js-yaml 库）
    const repos = parseYaml(config);

    // 获取容器元素
    const reposContainer = document.getElementById('repos-container');

    // 为每个仓库获取并显示提交信息
    for (const repo of repos.repositories) {
        try {
            const commits = await fetchCommits(repo.owner, repo.name);
            const repoElement = createRepoElement(repo, commits);
            reposContainer.appendChild(repoElement);
        } catch (error) {
            console.error(`Error fetching commits for ${repo.owner}/${repo.name}:`, error);
            const errorElement = document.createElement('div');
            errorElement.className = 'repo-card error';
            errorElement.innerHTML = `
                <h3>${repo.owner}/${repo.name}</h3>
                <p>无法加载提交信息</p>
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

// 从 GitHub API 获取提交信息
async function fetchCommits(owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`);
    if (!response.ok) {
        throw new Error(`GitHub API 请求失败: ${response.status}`);
    }
    return await response.json();
}

// 创建仓库卡片元素
function createRepoElement(repo, commits) {
    const repoElement = document.createElement('div');
    repoElement.className = 'repo-card';

    const commitsList = commits.map(commit => `
        <li class="commit">
            <a href="${commit.html_url}" target="_blank" class="commit-link">
                <span class="commit-message">${commit.commit.message.split('\n')[0]}</span>
                <span class="commit-meta">
                    <img src="${commit.author?.avatar_url || 'https://github.com/identicons/app.png'}" 
                         alt="${commit.commit.author.name}" class="avatar">
                    <span class="author">${commit.commit.author.name}</span>
                    <span class="date">${new Date(commit.commit.author.date).toLocaleDateString()}</span>
                </span>
            </a>
        </li>
    `).join('');

    repoElement.innerHTML = `
        <h3>
            <a href="https://github.com/${repo.owner}/${repo.name}" target="_blank">
                ${repo.owner}/${repo.name}
            </a>
        </h3>
        <ul class="commits-list">${commitsList}</ul>
        <a href="https://github.com/${repo.owner}/${repo.name}/commits/main" 
           target="_blank" class="view-all">
            查看所有提交 <i class="fas fa-external-link-alt"></i>
        </a>
    `;

    return repoElement;
}