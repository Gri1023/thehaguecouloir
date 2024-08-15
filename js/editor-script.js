document.addEventListener('DOMContentLoaded', () => {
    const addContentButton = document.getElementById('add-content');
    const editorContent = document.getElementById('editor-content');
    const exportJsonButton = document.getElementById('export-json');

    addContentButton.addEventListener('click', addContent);
    exportJsonButton.addEventListener('click', exportJson);

    function addContent() {
        const contentTypeSelect = document.createElement('select');
        contentTypeSelect.innerHTML = `
            <option value="subheading-text">Subheading Text</option>
            <option value="sub-subheading-text">Sub-Subheading Text</option>
            <option value="info-text">Info Text</option>
            <option value="text">Text</option>
            <option value="main-image">Main Image</option>
            <option value="image">Image</option>
            <option value="caption-text">Caption Text</option>
            <option value="quote">Quote</option>
            <option value="warning">Warning</option>
        `;

        const contentElement = document.createElement('div');
        contentElement.classList.add('content-element');
        contentElement.appendChild(contentTypeSelect);

        contentTypeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;

            // Clear previous content, keeping the select dropdown
            contentElement.innerHTML = '';
            contentElement.appendChild(contentTypeSelect);

            // Set the class of contentElement to match the selected type
            contentElement.className = `content-element ${selectedType}`;

            if (selectedType === 'main-image' || selectedType === 'image') {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';

                const filePreview = document.createElement('img');
                filePreview.classList.add('image-preview');

                const pathInput = document.createElement('input');
                pathInput.type = 'text';
                pathInput.placeholder = 'Enter image path';

                fileInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            filePreview.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });

                contentElement.appendChild(fileInput);
                contentElement.appendChild(filePreview);
                contentElement.appendChild(pathInput);
            } else {
                const contentInput = document.createElement('div');
                contentInput.contentEditable = 'true';
                contentInput.classList.add('editable-text');
                contentElement.appendChild(contentInput);
            }

            // Add a remove button to the content element
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.classList.add('remove-button');
            removeButton.addEventListener('click', () => {
                editorContent.removeChild(contentElement);
            });

            contentElement.appendChild(removeButton);
        });

        editorContent.appendChild(contentElement);
    }

    function exportJson() {
        const articleId = document.getElementById('article-id').value;
        const articleHeading = document.getElementById('article-heading').value;
        const articleDate = document.getElementById('article-date').value;

        if (!articleId || !articleHeading || !articleDate) {
            alert('ID, Heading Text, and Date are required.');
            return;
        }

        const content = Array.from(document.querySelectorAll('.content-element')).map(elem => {
            const select = elem.querySelector('select');
            const type = select ? select.value : null;
            const textContent = elem.querySelector('.editable-text')?.innerHTML || '';
            const imagePath = elem.querySelector('input[type="text"]')?.value || '';
            const imageSrc = elem.querySelector('.image-preview')?.src || '';

            return {
                type,
                text: textContent,
                imagePath,
                imageSrc
            };
        });

        const json = JSON.stringify({
            id: articleId,
            heading: articleHeading,
            date: articleDate,
            content
        }, null, 2);

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'article.json';
        a.click();
        URL.revokeObjectURL(url);
    }
});
