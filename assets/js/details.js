document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const repo = urlParams.get('repo');

    if (!repo) {
        window.location.href = '/';
        return;
    }

    // Find repo info from our data
    fetch('/data/repositories.yml')
        .then(response => response.text())
        .then(yamlText => {
            // Note: In a real implementation, you'd need a YAML parser
            // For simplicity, we'll assume we can find the repo info
            const repoName = repo.split('/')[1];
            document.getElementById('repo-name').textContent = repoName;

            // Fetch detailed commit info
            fetchRepoDetails(repo);
        })
        .catch(error => {
            console.error('Error loading repo data:', error);
        });
});

async function fetchRepoDetails(repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`);
        if (!response.ok) throw new Error('Failed to fetch commit data');

        const commits = await response.json();
        const updatesList = document.getElementById('updates-list');
        updatesList.innerHTML = '';

        commits.forEach(commit => {
            const updateItem = document.createElement('div');
            updateItem.className = 'update-item';

            const message = document.createElement('h3');
            message.textContent = commit.commit.message.split('\n')[0]; // First line only

            const date = document.createElement('p');
            const commitDate = new Date(commit.commit.author.date);
            date.textContent = `Updated at: ${commitDate.toLocaleString()}`;

            const author = document.createElement('p');
            author.textContent = `By: ${commit.commit.author.name}`;

            updateItem.appendChild(message);
            updateItem.appendChild(date);
            updateItem.appendChild(author);
            updatesList.appendChild(updateItem);
        });

    } catch (error) {
        console.error('Error fetching commit details:', error);
        document.getElementById('updates-list').innerHTML =
            '<p>Unable to load recent updates.</p>';
    }
}