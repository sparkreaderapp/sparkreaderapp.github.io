class SparkReaderCatalog {
    constructor() {
        this.books = [];
        this.filteredBooks = [];
        this.selectedTags = new Set();
        this.tagsByDimension = {};
        this.searchQuery = '';
        this.filtersExpanded = true;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCatalog();
        await this.loadTags();
        await this.loadReadme();
        this.renderFilters();
        this.filterAndRenderBooks();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            clearSearch.style.display = this.searchQuery ? 'block' : 'none';
            this.filterAndRenderBooks();
        });

        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            clearSearch.style.display = 'none';
            this.filterAndRenderBooks();
        });

        // Filter toggle
        const toggleFilters = document.getElementById('toggleFilters');
        const filterSection = document.getElementById('filterSection');
        const filterIcon = document.getElementById('filterIcon');

        toggleFilters.addEventListener('click', () => {
            this.filtersExpanded = !this.filtersExpanded;
            filterSection.style.display = this.filtersExpanded ? 'block' : 'none';
            filterIcon.textContent = this.filtersExpanded ? 'expand_less' : 'expand_more';
        });

        // Clear all filters
        const clearFilters = document.getElementById('clearFilters');
        clearFilters.addEventListener('click', () => {
            this.selectedTags.clear();
            this.updateFilterChips();
            this.filterAndRenderBooks();
        });

        // Info modal
        const infoButton = document.getElementById('infoButton');
        const infoModal = document.getElementById('infoModal');
        const closeModal = document.getElementById('closeModal');

        infoButton.addEventListener('click', () => {
            infoModal.classList.remove('hidden');
        });

        closeModal.addEventListener('click', () => {
            infoModal.classList.add('hidden');
        });

        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.classList.add('hidden');
            }
        });
    }

    async loadCatalog() {
        const urls = [
            // Try CORS proxy first
            //'https://api.allorigins.win/raw?url=https://github.com/sparkreaderapp/sparkreader-library/releases/download/v1.0.0/catalog-v1.0.0.json',
            // Fallback to raw GitHub content
            'https://raw.githubusercontent.com/sparkreaderapp/sparkreader-library/main/catalog/catalog.json'
        ];

        for (const url of urls) {
            try {
                console.log(`Attempting to load catalog from: ${url}`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
                this.books = await response.json();
                console.log(`Successfully loaded ${this.books.length} books from catalog`);
                document.getElementById('loadingState').classList.add('hidden');
                return;
            } catch (error) {
                console.warn(`Failed to load from ${url}:`, error);
                continue;
            }
        }

        // If all URLs failed
        console.error('Failed to load catalog from all sources');
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('errorState').classList.remove('hidden');
    }

    async loadTags() {
        const urls = [
            // Try CORS proxy first
            //'https://api.allorigins.win/raw?url=https://raw.githubusercontent.com/sparkreaderapp/sparkreader-library/main/catalog/tags.txt',
            // Direct GitHub raw content (may work in some cases)
            'https://raw.githubusercontent.com/sparkreaderapp/sparkreader-library/main/catalog/tags.txt'
        ];

        for (const url of urls) {
            try {
                console.log(`Attempting to load tags from: ${url}`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
                const tagsText = await response.text();
                this.parseTags(tagsText);
                console.log('Successfully loaded tags from file');
                return;
            } catch (error) {
                console.warn(`Failed to load tags from ${url}:`, error);
                continue;
            }
        }

        // If all URLs failed, fallback to extracting from books
        console.warn('Failed to load tags from all sources, extracting from books');
        this.extractTagsFromBooks();
    }

    async loadReadme() {
        const urls = [
            'https://raw.githubusercontent.com/sparkreaderapp/sparkreader-library/main/README.md'
        ];

        for (const url of urls) {
            try {
                console.log(`Attempting to load README from: ${url}`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
                const readmeText = await response.text();
                this.displayReadmeInModal(readmeText);
                console.log('Successfully loaded README');
                return;
            } catch (error) {
                console.warn(`Failed to load README from ${url}:`, error);
                continue;
            }
        }

        console.warn('Failed to load README, keeping default content');
    }

    displayReadmeInModal(markdownText) {
        // Simple markdown to HTML conversion for basic formatting
        let html = markdownText
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap in paragraphs
        html = '<p>' + html + '</p>';
        
        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '').replace(/<p><br>/g, '<p>');
        
        const modalContent = document.querySelector('#infoModal .md-modal-content');
        modalContent.innerHTML = html;
    }

    parseTags(tagsText) {
        const lines = tagsText.split('\n').filter(line => line.trim());
        const dimensions = {
            temporal: [],
            regional: [],
            discipline: [],
            'genre-fiction': [],
            'genre-nonfiction': []
        };

        lines.forEach(line => {
            const parts = line.trim().split('/');
            if (parts.length >= 2) {
                const dimension = parts[0].toLowerCase();
                
                if (parts.length >= 3 && dimension === 'genre') {
                    const genreType = parts[1].toLowerCase();
                    const value = parts[2];
                    
                    if (genreType === 'fiction') {
                        dimensions['genre-fiction'].push(value);
                    } else if (genreType === 'nonfiction' || genreType === 'non-fiction') {
                        dimensions['genre-nonfiction'].push(value);
                    }
                } else if (dimensions[dimension]) {
                    const value = parts[1];
                    if (!dimensions[dimension].includes(value)) {
                        dimensions[dimension].push(value);
                    }
                }
            }
        });

        this.tagsByDimension = dimensions;
    }

    extractTagsFromBooks() {
        // Fallback method to extract tags from book data
        const dimensions = {
            temporal: new Set(),
            regional: new Set(),
            discipline: new Set(),
            'genre-fiction': new Set(),
            'genre-nonfiction': new Set()
        };

        this.books.forEach(book => {
            if (book.tags) {
                const tags = book.tags.split(',').map(tag => tag.trim());
                tags.forEach(tag => {
                    const parts = tag.split('/');
                    if (parts.length >= 2) {
                        const dimension = parts[0].toLowerCase();
                        
                        if (parts.length >= 3 && dimension === 'genre') {
                            const genreType = parts[1].toLowerCase();
                            const value = parts[2];
                            
                            if (genreType === 'fiction') {
                                dimensions['genre-fiction'].add(value);
                            } else if (genreType === 'nonfiction' || genreType === 'non-fiction') {
                                dimensions['genre-nonfiction'].add(value);
                            }
                        } else if (dimensions[dimension]) {
                            dimensions[dimension].add(parts[1]);
                        }
                    }
                });
            }
        });

        // Convert sets to arrays
        Object.keys(dimensions).forEach(key => {
            this.tagsByDimension[key] = Array.from(dimensions[key]).sort();
        });
    }

    renderFilters() {
        const filterMappings = [
            { id: 'temporalFilters', dimension: 'temporal', class: 'temporal' },
            { id: 'regionalFilters', dimension: 'regional', class: 'regional' },
            { id: 'disciplineFilters', dimension: 'discipline', class: 'discipline' }
        ];

        filterMappings.forEach(({ id, dimension, class: className }) => {
            const container = document.getElementById(id);
            const tags = this.tagsByDimension[dimension] || [];
            
            // Clear existing chips (keep label)
            const label = container.querySelector('.md-filter-label');
            container.innerHTML = '';
            container.appendChild(label);

            tags.forEach(tag => {
                const chip = this.createFilterChip(tag, className);
                container.appendChild(chip);
            });
        });

        // Handle genre filters separately
        const genreContainer = document.getElementById('genreFilters');
        const genreLabel = genreContainer.querySelector('.md-filter-label');
        genreContainer.innerHTML = '';
        genreContainer.appendChild(genreLabel);

        // Fiction genres
        const fictionTags = this.tagsByDimension['genre-fiction'] || [];
        fictionTags.forEach(tag => {
            const chip = this.createFilterChip(tag, 'genre-fiction');
            genreContainer.appendChild(chip);
        });

        // Add separator if both fiction and non-fiction exist
        if (fictionTags.length > 0 && (this.tagsByDimension['genre-nonfiction'] || []).length > 0) {
            const separator = document.createElement('span');
            separator.textContent = '|';
            separator.style.color = 'var(--md-sys-color-on-surface-variant)';
            separator.style.margin = '0 0.5rem';
            genreContainer.appendChild(separator);
        }

        // Non-fiction genres
        const nonfictionTags = this.tagsByDimension['genre-nonfiction'] || [];
        nonfictionTags.forEach(tag => {
            const chip = this.createFilterChip(tag, 'genre-nonfiction');
            genreContainer.appendChild(chip);
        });
    }

    createFilterChip(tag, className) {
        const chip = document.createElement('button');
        chip.className = `md-filter-chip ${className}`;
        chip.textContent = tag;
        chip.dataset.tag = tag;
        
        chip.addEventListener('click', () => {
            if (this.selectedTags.has(tag)) {
                this.selectedTags.delete(tag);
                chip.classList.remove('selected');
            } else {
                this.selectedTags.add(tag);
                chip.classList.add('selected');
            }
            this.filterAndRenderBooks();
        });

        return chip;
    }

    updateFilterChips() {
        document.querySelectorAll('.md-filter-chip').forEach(chip => {
            const tag = chip.dataset.tag;
            if (this.selectedTags.has(tag)) {
                chip.classList.add('selected');
            } else {
                chip.classList.remove('selected');
            }
        });

        // Update clear filters button visibility
        const clearFilters = document.getElementById('clearFilters');
        const filterCount = document.getElementById('filterCount');
        
        if (this.selectedTags.size > 0) {
            clearFilters.style.display = 'inline';
            filterCount.textContent = `${this.selectedTags.size} filter${this.selectedTags.size === 1 ? '' : 's'} active`;
        } else {
            clearFilters.style.display = 'none';
            filterCount.textContent = '';
        }
    }

    filterAndRenderBooks() {
        this.filteredBooks = this.books.filter(book => {
            // Text search filter
            if (this.searchQuery) {
                const searchableText = [
                    book.title,
                    book.author,
                    book.description,
                    this.getTagDisplayValues(book.tags).join(' ')
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(this.searchQuery)) {
                    return false;
                }
            }

            // Tag filters (intersection - book must have ALL selected tags)
            if (this.selectedTags.size > 0) {
                const bookTagValues = this.getTagDisplayValues(book.tags);
                
                for (const selectedTag of this.selectedTags) {
                    if (!bookTagValues.some(tagValue => 
                        tagValue.toLowerCase() === selectedTag.toLowerCase())) {
                        return false;
                    }
                }
            }

            return true;
        });

        this.renderBooks();
        this.updateStats();
        this.updateFilterChips();
    }

    getTagDisplayValues(tagsString) {
        if (!tagsString) return [];
        
        return tagsString.split(',')
            .map(tag => tag.trim())
            .map(tag => {
                const parts = tag.split('/');
                if (parts.length >= 3 && parts[0].toLowerCase() === 'genre') {
                    return parts[2]; // For genre tags, return the third level
                } else if (parts.length >= 2) {
                    return parts[1]; // For other tags, return the second level
                }
                return tag; // Fallback
            })
            .filter(tag => tag);
    }

    renderBooks() {
        const bookList = document.getElementById('bookList');
        bookList.innerHTML = '';

        this.filteredBooks.forEach(book => {
            const bookCard = this.createBookCard(book);
            bookList.appendChild(bookCard);
        });
    }

    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'md-book-card';

        const bookTags = this.parseBookTags(book.tags);
        
        card.innerHTML = `
            <div class="md-book-header">
                <div class="md-book-icon">
                    <span class="material-icons">book</span>
                </div>
                <div class="md-book-content">
                    <h3 class="md-book-title md-typescale-title-medium">${this.escapeHtml(book.title)}</h3>
                    <p class="md-book-author md-typescale-body-medium">by ${this.escapeHtml(book.author)}${book.date ? ` (${book.date})` : ''}</p>
                    ${book.description ? `<p class="md-book-description md-typescale-body-small">${this.escapeHtml(book.description)}</p>` : ''}
                    ${bookTags.length > 0 ? `
                        <div class="md-book-tags">
                            ${bookTags.map(tag => this.createTagChip(tag)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        return card;
    }

    parseBookTags(tagsString) {
        if (!tagsString) return [];
        
        return tagsString.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);
    }

    createTagChip(tag) {
        const parts = tag.split('/');
        const dimension = parts[0]?.toLowerCase();
        let className = 'md-tag-chip';
        let displayValue = tag;

        if (parts.length >= 2) {
            if (parts.length >= 3 && dimension === 'genre') {
                const genreType = parts[1].toLowerCase();
                displayValue = parts.slice(1).join('/'); // Show "fiction/mystery" or "nonfiction/history"
                className += genreType === 'fiction' ? ' genre-fiction' : ' genre-nonfiction';
            } else {
                displayValue = parts.slice(1).join('/'); // Show everything after dimension
                if (['temporal', 'regional', 'discipline'].includes(dimension)) {
                    className += ` ${dimension}`;
                }
            }
        }

        return `<span class="${className}">${this.escapeHtml(displayValue)}</span>`;
    }

    updateStats() {
        const bookCount = document.getElementById('bookCount');
        const count = this.filteredBooks.length;
        bookCount.textContent = `${count} book${count === 1 ? '' : 's'} available`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the catalog when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SparkReaderCatalog();
});
