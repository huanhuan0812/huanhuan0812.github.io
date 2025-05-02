document.addEventListener('DOMContentLoaded', function() {
    // Fetch last update time for each repo
    document.querySelectorAll('.card').forEach(card => {
        const repo = card.dataset.repo;
        fetchRepoInfo(repo, card);

        // Add click event to navigate to details page
        card.addEventListener('click', () => {
            window.location.href = `/details.html?repo=${repo}`;
        });
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