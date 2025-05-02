document.addEventListener('DOMContentLoaded', function() {
    // 卡片悬停效果
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        // 鼠标进入时添加类名
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'all 0.3s ease';
        });

        // 鼠标离开时重置过渡
        card.addEventListener('mouseleave', () => {
            card.style.transition = 'all 0.3s ease';
        });

        // 点击卡片跳转
        card.addEventListener('click', () => {
            const repo = card.dataset.repo;
            window.location.href = `/details.html?repo=${repo}`;
        });

        // 获取仓库信息
        const repo = card.dataset.repo;
        fetchRepoInfo(repo, card);
    });
});

async function fetchRepoInfo(repo, cardElement) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/commits`);
        if (!response.ok) throw new Error('Failed to fetch repo data');

        const commits = await response.json();
        if (commits.length > 0) {
            const lastCommit = commits[0];
            const date = new Date(lastCommit.commit.author.date);
            cardElement.querySelector('.last-updated').textContent =
                `Last updated: ${date.toLocaleDateString()}`;
        }
    } catch (error) {
        console.error('Error fetching repo info:', error);
        cardElement.querySelector('.last-updated').textContent =
            'Update time unavailable';
    }
}