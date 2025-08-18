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

// 初始化加载缓存
function loadCacheFromStorage() {
  const keys = ['repoData', 'branches', 'tags', 'commits', 'releases', 'issues'];
  keys.forEach(key => {
    const data = localStorage.getItem(key);
    const lastUpdated = localStorage.getItem(`${key}_lastUpdated`);
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
    console.log(`使用缓存数据: ${cacheKey}`);
    showCacheStatus();
    return cache[cacheKey];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);

    const data = await response.json();
    // 更新缓存
    cache[cacheKey] = data;
    cache.lastUpdated[cacheKey] = Date.now();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(`${cacheKey}_lastUpdated`, Date.now());

    return data;
  } catch (error) {
    console.error(`获取${cacheKey}时出错:`, error);
    // 尝试使用localStorage缓存
    const storedData = localStorage.getItem(cacheKey);
    if (storedData) {
      console.log(`回退到localStorage缓存: ${cacheKey}`);
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

// 页面加载
document.addEventListener('DOMContentLoaded', function() {
  loadCacheFromStorage();
  addRefreshButton();

  const urlParams = new URLSearchParams(window.location.search);
  const repoFullName = urlParams.get('repo');

  if (!repoFullName) {
    window.location.href = '/';
    return;
  }

  // 设置基本信息
  const [owner, repo] = repoFullName.split('/');
  document.getElementById('repo-name').querySelector('span').textContent = repo;

  // 设置链接
  document.getElementById('repo-url').href = `https://github.com/${repoFullName}`;
  document.getElementById('releases-url').href = `https://github.com/${repoFullName}/releases`;
  document.getElementById('issues-url').href = `https://github.com/${repoFullName}/issues`;
  document.getElementById('pulls-url').href = `https://github.com/${repoFullName}/pulls`;

  // 获取数据
  fetchRepoDetails(repoFullName);
  setupTabs();
});

function addRefreshButton() {
  const header = document.querySelector('.repo-header');
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

async function fetchRepoDetails(repoFullName) {
  const cacheKey = `repoData_${repoFullName}`;

  try {
    const repoData = await cachedFetch(`https://api.github.com/repos/${repoFullName}`, cacheKey);

    document.getElementById('repo-description').textContent = repoData.description || '无描述';
    document.getElementById('stargazers-count').textContent = repoData.stargazers_count;
    document.getElementById('watchers-count').textContent = repoData.watchers_count;
    document.getElementById('forks-count').textContent = repoData.forks_count;
    document.getElementById('open-issues').textContent = repoData.open_issues_count;

    const metaContainer = document.getElementById('repo-meta');
    metaContainer.innerHTML = `
      <span class="repo-meta-item"><i class="fas fa-code"></i> ${repoData.language || '未知'}</span>
      <span class="repo-meta-item"><i class="fas fa-calendar-alt"></i> ${new Date(repoData.created_at).toLocaleDateString()}</span>
      <span class="repo-meta-item"><i class="fas fa-sync-alt"></i> ${new Date(repoData.updated_at).toLocaleDateString()}</span>
    `;

    fetchBranches(repoFullName);
    fetchCommits(repoFullName);
    fetchReleases(repoFullName);
    fetchIssues(repoFullName);
    fetchTags(repoFullName);
    fetchReadme(repoFullName);

  } catch (error) {
    console.error('获取仓库详情时出错:', error);
    document.getElementById('repo-description').textContent = '加载仓库详情失败';
  }
}

async function fetchBranches(repoFullName) {
  const cacheKey = `branches_${repoFullName}`;

  try {
    const branches = await cachedFetch(`https://api.github.com/repos/${repoFullName}/branches`, cacheKey);
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
      fetchCommits(repoFullName, branchSelector.value);
    });

  } catch (error) {
    console.error('获取分支时出错:', error);
    document.getElementById('branch-selector').innerHTML = '<option value="">加载分支失败</option>';
  }
}

async function fetchTags(repoFullName) {
  const cacheKey = `tags_${repoFullName}`;

  try {
    const tags = await cachedFetch(`https://api.github.com/repos/${repoFullName}/tags`, cacheKey);
    const tagsList = document.getElementById('tags-list');

    if (tags.length === 0) {
      tagsList.innerHTML = '<p>无标签</p>';
      return;
    }

    tagsList.innerHTML = '';
    tags.slice(0, 10).forEach(tag => {
      const tagElement = document.createElement('a');
      tagElement.className = 'tag';
      tagElement.href = `https://github.com/${repoFullName}/releases/tag/${tag.name}`;
      tagElement.target = '_blank';
      tagElement.title = tag.name;
      tagElement.innerHTML = `<i class="fas fa-tag"></i><span>${tag.name}</span>`;
      tagsList.appendChild(tagElement);
    });

    if (tags.length > 10) {
      const moreLink = document.createElement('a');
      moreLink.className = 'tag';
      moreLink.href = `https://github.com/${repoFullName}/tags`;
      moreLink.target = '_blank';
      moreLink.textContent = `+${tags.length - 10} 更多`;
      tagsList.appendChild(moreLink);
    }

  } catch (error) {
    console.error('获取标签时出错:', error);
    document.getElementById('tags-list').innerHTML = '<p>加载标签失败</p>';
  }
}

let currentPage = 1;
async function fetchCommits(repoFullName, branch = 'main') {
  const cacheKey = `commits_${repoFullName}_${branch}_${currentPage}`;

  try {
    const commits = await cachedFetch(
      `https://api.github.com/repos/${repoFullName}/commits?sha=${branch}&page=${currentPage}&per_page=10`,
      cacheKey
    );

    const commitsList = document.getElementById('commits-list');
    if (currentPage === 1) commitsList.innerHTML = '';

    if (commits.length === 0) {
      if (currentPage === 1) commitsList.innerHTML = '<p>无提交记录</p>';
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
      fetchCommits(repoFullName, branch);
    };

  } catch (error) {
    console.error('获取提交记录时出错:', error);
    document.getElementById('commits-list').innerHTML = '<p>加载提交记录失败</p>';
  }
}

async function fetchReleases(repoFullName) {
  const cacheKey = `releases_${repoFullName}`;

  try {
    const releases = await cachedFetch(
      `https://api.github.com/repos/${repoFullName}/releases?per_page=5`,
      cacheKey
    );

    const releasesList = document.getElementById('releases-list');
    releasesList.innerHTML = releases.length === 0 ? '<p>无版本发布</p>' : '';

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
        ${release.body ? `<div class="release-body">${marked.parse(release.body)}</div>` : ''}
      `;
      releasesList.appendChild(releaseItem);
    });

  } catch (error) {
    console.error('获取版本发布时出错:', error);
    document.getElementById('releases-list').innerHTML = '<p>加载版本发布失败</p>';
  }
}

async function fetchIssues(repoFullName) {
  const cacheKey = `issues_${repoFullName}`;

  try {
    const issues = await cachedFetch(
      `https://api.github.com/repos/${repoFullName}/issues?per_page=5`,
      cacheKey
    );

    const issuesList = document.getElementById('issues-list');
    issuesList.innerHTML = issues.length === 0 ? '<p>无最近问题</p>' : '';

    issues.forEach(issue => {
      const issueItem = document.createElement('div');
      issueItem.className = 'issue-item';
      const date = new Date(issue.created_at);

      issueItem.innerHTML = `
        <h4>${issue.title}</h4>
        <div class="issue-meta">
          <span><i class="fas fa-user"></i> ${issue.user.login}</span>
          <span><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
          <span><i class="fas fa-comment"></i> ${issue.comments} 条评论</span>
          <a href="${issue.html_url}" target="_blank"><i class="fas fa-external-link-alt"></i> 查看</a>
        </div>
        ${issue.body ? `<div class="issue-body">${marked.parse(issue.body.substring(0, 200))}...</div>` : ''}
      `;
      issuesList.appendChild(issueItem);
    });

  } catch (error) {
    console.error('获取问题时出错:', error);
    document.getElementById('issues-list').innerHTML = '<p>加载问题失败</p>';
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

async function fetchReadme(repoFullName) {
  const cacheKey = `readme_${repoFullName}`;

  try {
    const readmeData = await cachedFetch(
      `https://api.github.com/repos/${repoFullName}/readme`,
      cacheKey
    );

    try {
      // 修复中文乱码的解码方式
      const binaryString = atob(readmeData.content.replace(/\s/g, ''));
      const content = decodeURIComponent(Array.prototype.map.call(binaryString, function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const readmeContent = document.getElementById('readme-content');
      readmeContent.innerHTML = marked.parse(content);
    } catch (decodeError) {
      console.error('解码README内容时出错:', decodeError);
      // 尝试更简单的解码方式作为后备
      try {
        const content = atob(readmeData.content);
        document.getElementById('readme-content').innerHTML = marked.parse(content);
      } catch (simpleError) {
        document.getElementById('readme-content').innerHTML = 
          '<p>解码README内容时出错，可能包含不支持的字符</p>';
      }
    }

  } catch (error) {
    console.error('获取README时出错:', error);
    const errorMsg = error.status === 404 
      ? '<p>该仓库没有README文件</p>' 
      : '<p>加载README失败: ' + error.message + '</p>';
    document.getElementById('readme-content').innerHTML = errorMsg;
  }
}