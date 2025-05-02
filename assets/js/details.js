document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const repoFullName = urlParams.get('repo');

    if (!repoFullName) {
        window.location.href = '/';
        return;
    }

    // 设置仓库基本信息
    const [owner, repo] = repoFullName.split('/');
    document.getElementById('repo-name').querySelector('span').textContent = repo;

    // 设置各种URL
    document.getElementById('repo-url').href = `https://github.com/${repoFullName}`;
    document.getElementById('releases-url').href = `https://github.com/${repoFullName}/releases`;
    document.getElementById('issues-url').href = `https://github.com/${repoFullName}/issues`;
    document.getElementById('pulls-url').href = `https://github.com/${repoFullName}/pulls`;

    // 获取仓库详细信息
    fetchRepoDetails(repoFullName);

    // 获取分支列表
    fetchBranches(repoFullName);

    // 设置标签切换功能
    setupTabs();
});

async function fetchRepoDetails(repoFullName) {
    try {
        const repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`);
        if (!repoResponse.ok) throw new Error('Failed to fetch repo details');

        const repoData = await repoResponse.json();

        // 更新仓库描述
        document.getElementById('repo-description').textContent =
            repoData.description || 'No description provided';

        // 更新统计数据
        document.getElementById('stargazers-count').textContent = repoData.stargazers_count;
        document.getElementById('watchers-count').textContent = repoData.watchers_count;
        document.getElementById('forks-count').textContent = repoData.forks_count;
        document.getElementById('open-issues').textContent = repoData.open_issues_count;

        // 更新元数据
        const metaContainer = document.getElementById('repo-meta');
        metaContainer.innerHTML = `
      <span class="repo-meta-item">
        <i class="fas fa-code"></i> ${repoData.language || 'Unknown'}
      </span>
      <span class="repo-meta-item">
        <i class="fas fa-calendar-alt"></i> ${new Date(repoData.created_at).toLocaleDateString()}
      </span>
      <span class="repo-meta-item">
        <i class="fas fa-sync-alt"></i> ${new Date(repoData.updated_at).toLocaleDateString()}
      </span>
    `;

        // 获取提交记录
        fetchCommits(repoFullName);

        // 获取发布版本
        fetchReleases(repoFullName);

        // 获取最近问题
        fetchIssues(repoFullName);

    } catch (error) {
        console.error('Error fetching repo details:', error);
        document.getElementById('repo-description').textContent = 'Failed to load repository details';
    }
}

async function fetchBranches(repoFullName) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/branches`);
        if (!response.ok) throw new Error('Failed to fetch branches');

        const branches = await response.json();
        const branchSelector = document.getElementById('branch-selector');

        branchSelector.innerHTML = '';
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.name;
            option.textContent = branch.name;
            branchSelector.appendChild(option);
        });

        // 默认选择master/main分支
        const defaultBranch = branches.find(b => b.name === 'main' || b.name === 'master');
        if (defaultBranch) {
            branchSelector.value = defaultBranch.name;
        }

        // 分支选择事件
        branchSelector.addEventListener('change', () => {
            fetchCommits(repoFullName, branchSelector.value);
        });

    } catch (error) {
        console.error('Error fetching branches:', error);
        branchSelector.innerHTML = '<option value="">Failed to load branches</option>';
    }
}

let currentPage = 1;
async function fetchCommits(repoFullName, branch = 'main') {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${repoFullName}/commits?sha=${branch}&page=${currentPage}&per_page=10`
        );
        if (!response.ok) throw new Error('Failed to fetch commits');

        const commits = await response.json();
        const commitsList = document.getElementById('commits-list');

        if (currentPage === 1) {
            commitsList.innerHTML = '';
        }

        if (commits.length === 0) {
            if (currentPage === 1) {
                commitsList.innerHTML = '<p>No commits found</p>';
            }
            document.getElementById('load-more-commits').style.display = 'none';
            return;
        }

        commits.forEach(commit => {
            const commitItem = document.createElement('div');
            commitItem.className = 'commit-item';

            const message = commit.commit.message.split('\n')[0];
            const date = new Date(commit.commit.author.date);
            const author = commit.commit.author.name;

            commitItem.innerHTML = `
        <div class="commit-message">${message}</div>
        <div class="commit-meta">
          <span><i class="fas fa-user"></i> ${author}</span>
          <span><i class="far fa-calendar-alt"></i> ${date.toLocaleString()}</span>
          <a href="${commit.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> View</a>
        </div>
      `;

            commitsList.appendChild(commitItem);
        });

        document.getElementById('load-more-commits').style.display = 'block';
        document.getElementById('load-more-commits').onclick = () => {
            currentPage++;
            fetchCommits(repoFullName, branch);
        };

    } catch (error) {
        console.error('Error fetching commits:', error);
        document.getElementById('commits-list').innerHTML = '<p>Failed to load commits</p>';
    }
}

async function fetchReleases(repoFullName) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/releases?per_page=5`);
        if (!response.ok) throw new Error('Failed to fetch releases');

        const releases = await response.json();
        const releasesList = document.getElementById('releases-list');

        if (releases.length === 0) {
            releasesList.innerHTML = '<p>No releases found</p>';
            return;
        }

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
        releasesList.innerHTML = '<p>Failed to load releases</p>';
    }
}

async function fetchIssues(repoFullName) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/issues?per_page=5`);
        if (!response.ok) throw new Error('Failed to fetch issues');

        const issues = await response.json();
        const issuesList = document.getElementById('issues-list');

        if (issues.length === 0) {
            issuesList.innerHTML = '<p>No recent issues found</p>';
            return;
        }

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
        issuesList.innerHTML = '<p>Failed to load issues</p>';
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有active类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加active类到当前标签
            button.classList.add('active');
            const tabName = button.dataset.tab;
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}