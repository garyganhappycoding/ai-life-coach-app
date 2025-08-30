/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";

// --- DOM Elements ---
const headerTitle = document.querySelector('header h1') as HTMLElement;
const entriesContainer = document.getElementById('entries-container') as HTMLElement;
const addEntryBtn = document.getElementById('add-entry-btn') as HTMLButtonElement;
const modalOverlay = document.getElementById('modal-overlay') as HTMLDivElement;
const modal = document.getElementById('modal') as HTMLDivElement;
const modalTitle = document.getElementById('modal-title') as HTMLHeadingElement;
const entryForm = document.getElementById('entry-form') as HTMLFormElement;
const entryTitle = document.getElementById('entry-title') as HTMLInputElement;
const entryContent = document.getElementById('entry-content') as HTMLTextAreaElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const deleteBtn = document.getElementById('delete-btn') as HTMLButtonElement;
const loaderOverlay = document.getElementById('loader-overlay') as HTMLDivElement;
const navDiaryBtn = document.getElementById('nav-diary') as HTMLButtonElement;
const navTrashBtn = document.getElementById('nav-trash') as HTMLButtonElement;
const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;


// --- App State ---
interface DiaryEntry {
    id: number;
    date: string;
    title: string;
    content: string;
    status: 'active' | 'trashed';
    coachSummary?: string;
}

let entries: DiaryEntry[] = [];
let currentlyEditingEntryId: number | null = null;
let currentView: 'diary' | 'trash' = 'diary';
let searchQuery: string = '';
let expandedEntryId: number | null = null;

// --- Gemini AI Initialization ---
let ai: GoogleGenAI;
try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    showError("Could not initialize AI service. Please check your API key configuration.");
}


// --- Functions ---

/**
 * Renders the entire application based on the current state (view).
 */
function renderApp() {
    // Update nav button states
    navDiaryBtn.classList.toggle('active', currentView === 'diary');
    navTrashBtn.classList.toggle('active', currentView === 'trash');
    
    // Show/hide FAB
    addEntryBtn.classList.toggle('hidden', currentView !== 'diary');

    if (currentView === 'diary') {
        renderDiaryPage();
    } else {
        renderTrashPage();
    }
}

/**
 * Renders the main diary page with active entries.
 */
function renderDiaryPage() {
    if (!entriesContainer) return;
    headerTitle.textContent = "My Diary";
    entriesContainer.innerHTML = '';
    
    let activeEntries = entries.filter(e => e.status === 'active');

    if (searchQuery) {
        expandedEntryId = null; // Collapse all entries during search
        const lowerCaseQuery = searchQuery.toLowerCase();
        activeEntries = activeEntries.filter(entry =>
            entry.title.toLowerCase().includes(lowerCaseQuery) ||
            entry.content.toLowerCase().includes(lowerCaseQuery) ||
            (entry.coachSummary && entry.coachSummary.toLowerCase().includes(lowerCaseQuery))
        );
    }
    
    activeEntries.sort((a, b) => b.id - a.id);

    if (activeEntries.length === 0) {
        if (searchQuery) {
            entriesContainer.innerHTML = `<p class="placeholder">No results found for "<strong>${searchQuery}</strong>".</p>`;
        } else {
            entriesContainer.innerHTML = `<p class="placeholder">Your diary is empty. Tap the '+' button to add your first entry!</p>`;
        }
        return;
    }

    activeEntries.forEach(entry => {
        const isExpanded = entry.id === expandedEntryId && !searchQuery;
        const entryElement = document.createElement('article');
        entryElement.className = `diary-entry ${!isExpanded ? 'collapsed' : ''}`;
        entryElement.setAttribute('data-id', entry.id.toString());
        
        const coachSummaryHtml = entry.coachSummary 
            ? `<div class="ai-coach-summary"><strong>AI Coach:</strong> ${entry.coachSummary.replace(/\n/g, '<br>')}</div>` 
            : '';
        const coachButtonHtml = !entry.coachSummary 
            ? `<button class="ai-coach-btn" data-id="${entry.id}">AI Coach</button>` 
            : '';

        entryElement.innerHTML = `
            <div class="entry-header" role="button" tabindex="0" aria-expanded="${isExpanded}" aria-controls="entry-body-${entry.id}" data-id="${entry.id}">
                <h3>${entry.title}</h3>
                <p class="entry-date">${entry.date}</p>
            </div>
            <div class="entry-body" id="entry-body-${entry.id}">
                <p class="entry-content">${entry.content.replace(/\n/g, '<br>')}</p>
                <div class="entry-footer">
                    ${coachSummaryHtml}
                    <div class="entry-actions">
                        ${coachButtonHtml}
                        <button class="edit-btn" data-id="${entry.id}">Edit</button>
                    </div>
                </div>
            </div>
        `;
        
        entriesContainer.appendChild(entryElement);
    });
}


/**
 * Renders the trash page with deleted entries.
 */
function renderTrashPage() {
    if (!entriesContainer) return;
    headerTitle.textContent = "Trash";
    entriesContainer.innerHTML = '';
    
    let trashedEntries = entries.filter(e => e.status === 'trashed');

    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        trashedEntries = trashedEntries.filter(entry =>
            entry.title.toLowerCase().includes(lowerCaseQuery) ||
            entry.content.toLowerCase().includes(lowerCaseQuery) ||
            (entry.coachSummary && entry.coachSummary.toLowerCase().includes(lowerCaseQuery))
        );
    }
    
    trashedEntries.sort((a, b) => b.id - a.id);

    if (trashedEntries.length === 0) {
        if (searchQuery) {
            entriesContainer.innerHTML = `<p class="placeholder">No results found in trash for "<strong>${searchQuery}</strong>".</p>`;
        } else {
            entriesContainer.innerHTML = `<p class="placeholder">Your trash is empty.</p>`;
        }
        return;
    }

    trashedEntries.forEach(entry => {
        const entryElement = document.createElement('article');
        entryElement.className = 'diary-entry trashed-entry';
        entryElement.setAttribute('data-id', entry.id.toString());
        entryElement.innerHTML = `
            <h3>${entry.title}</h3>
            <p class="entry-date">${entry.date}</p>
            <p>${entry.content.replace(/\n/g, '<br>')}</p>
            <div class="trashed-entry-actions">
                <button class="restore-btn" data-id="${entry.id}">Restore</button>
                <button class="delete-perm-btn" data-id="${entry.id}">Delete Permanently</button>
            </div>
        `;
        entriesContainer.appendChild(entryElement);
    });
}


/**
 * Loads entries from localStorage and migrates old data structure if necessary.
 */
function loadEntries() {
    try {
        const storedEntries = localStorage.getItem('diaryEntries');
        if (storedEntries) {
            entries = JSON.parse(storedEntries).map((entry: any) => ({
                ...entry,
                status: entry.status || 'active', // Ensure all entries have a status
            }));
        }
    } catch (error) {
        console.error("Failed to load entries from localStorage:", error);
        entries = [];
    }
}

/**
 * Saves the current entries state to localStorage.
 */
function saveEntries() {
    try {
        localStorage.setItem('diaryEntries', JSON.stringify(entries));
    } catch (error) {
        console.error("Failed to save entries to localStorage:", error);
    }
}

/**
 * Toggles the visibility of the modal and prepares it for new or existing entry.
 * @param {boolean} show - Whether to show or hide the modal.
 */
function toggleModal(show: boolean) {
    if (!modalOverlay) return;
    if (show) {
        modalOverlay.classList.remove('hidden');
        entryContent.focus();
    } else {
        modalOverlay.classList.add('hidden');
        // Reset modal state
        entryForm.reset();
        currentlyEditingEntryId = null;
        modalTitle.textContent = "New Entry";
        saveBtn.textContent = "Save";
        deleteBtn.classList.add('hidden');
    }
}

/**
 * Opens the modal to edit an existing entry.
 * @param {number} entryId - The ID of the entry to edit.
 */
function openEditModal(entryId: number) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    currentlyEditingEntryId = entry.id;
    entryTitle.value = entry.title;
    entryContent.value = entry.content;
    
    modalTitle.textContent = "Edit Entry";
    saveBtn.textContent = "Save Changes";
    deleteBtn.classList.remove('hidden');
    
    toggleModal(true);
}

/**
 * Toggles the visibility of the loading spinner.
 * @param {boolean} show - Whether to show or hide the loader.
 */
function toggleLoader(show: boolean) {
    if (!loaderOverlay) return;
    loaderOverlay.classList.toggle('hidden', !show);
}

/**
 * Generates a title for the diary entry using the Gemini API.
 * @param {string} content - The content of the diary entry.
 * @param {string} dateString - The date of the entry, to be used as a fallback title.
 * @returns {Promise<string>} A promise that resolves to the generated title.
 */
async function generateTitle(content: string, dateString: string): Promise<string> {
    if (!ai) {
        return dateString; // Fallback title
    }
    try {
        const prompt = `Based on the following diary entry, suggest a short, one-line title for it (max 5 words). Do not use quotes:\n\n---\n${content}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim() || dateString;
    } catch (error) {
        console.error("Error generating title with Gemini:", error);
        return dateString; // Fallback title on error
    }
}

/**
 * Generates a supportive summary for the diary entry using the Gemini API.
 * @param {string} content - The content of the diary entry.
 * @returns {Promise<string>} A promise that resolves to the generated summary.
 */
async function getAiCoachSummary(content: string): Promise<string> {
    if (!ai) {
        return "AI is currently unavailable.";
    }
    try {
        const prompt = `# AI Life Coach System Prompt

You are an AI Life Coach specializing in diary analysis and personal development. Your primary function is to analyze diary entries and provide personalized coaching guidance to help users achieve their goals and overcome challenges.

## Your Core Responsibilities

1. **Pattern Analysis**: Identify recurring themes, emotions, behaviors, and experiences in diary entries
2. **Blind Spot Detection**: Recognize limiting beliefs, cognitive biases, or self-sabotaging patterns the user might not see
3. **Goal Clarification**: Help define clear, specific, and meaningful goals based on diary content
4. **Actionable Insights**: Provide practical, step-by-step recommendations tailored to the user's situation
5. **Reflective Questioning**: Ask open-ended questions that deepen self-awareness
6. **Progress Tracking**: Monitor growth over time by comparing current entries to previous ones
7. **Accountability**: Gently hold users accountable for their commitments and goals

## Key Functions You Provide

- **Goal Clarification**: Help users define clear, specific, and meaningful personal or professional goals
- **Blind Spot Detection**: Identify hidden thought patterns, cognitive biases, or habitual behaviors that limit growth
- **Reflective Questioning**: Ask open-ended and clarifying questions to enhance self-awareness and insight
- **Actionable Advice**: Provide practical, step-by-step recommendations to improve habits, mindset, and behaviors
- **Motivation and Encouragement**: Offer positive reinforcement and motivation to maintain momentum
- **Accountability**: Check progress regularly and nudge users to stay on track without judgment
- **Habit Tracking**: Support tracking habits and routines, analyze progress and suggest adjustments
- **Problem-Solving Assistance**: Help brainstorm solutions and strategies for overcoming obstacles
- **Emotional Support**: Offer empathy and non-judgmental listening to foster mental well-being
- **Time Management Guidance**: Advise on prioritizing tasks and balancing commitments
- **Personalized Feedback**: Tailor advice and coaching to individual personality and circumstances
- **Continuous Adaptation**: Modify coaching style based on ongoing user input and progress

## Your Coaching Approach
- Be empathetic yet direct - point out patterns honestly while maintaining support
- Ask thought-provoking questions that help users discover insights themselves
- Reference specific diary entries or themes when providing guidance
- Suggest concrete, actionable steps rather than vague advice
- Track progress by comparing current entries to previous ones
- Adapt your coaching style based on the user's personality and preferences as revealed in their writing
- Maintain a non-judgmental, supportive tone while encouraging growth and accountability

## Diary Analysis Framework

When analyzing diary entries, focus on these key areas:
- **Emotional Patterns**: What triggers certain feelings? What consistently lifts or dampens mood?
- **Behavioral Patterns**: What habits, actions, or reactions appear repeatedly?
- **Goal Clarity**: What does the user consistently write about wanting to achieve or change?
- **Recurring Obstacles**: What challenges, excuses, or barriers come up repeatedly?
- **Growth Opportunities**: Where does the user show potential for positive change?
- **Blind Spots**: What patterns might the user be missing about themselves?
- **Progress Indicators**: Signs of growth, improvement, or positive changes over time

## Response Structure

Structure your coaching responses using this format:

1. **Key Observations**: Summarize the main patterns or themes you noticed in the diary entries
2. **Blind Spot Alert**: Highlight what the user might not be seeing about themselves or their situation  
3. **Reflective Questions**: Ask 2-3 thoughtful questions to help the user think deeper about these patterns
4. **Actionable Recommendations**: Provide specific, practical steps the user can take based on your analysis
5. **Accountability Check**: Compare to previous entries - is the user making progress on past commitments or goals?
6. **Encouragement**: End with motivation and positive reinforcement for their self-reflection journey

## Instructions for Use

When a user shares diary entries with you:
1. Read through all provided entries carefully
2. Identify patterns, themes, and insights using the analysis framework
3. Provide coaching using the structured response format above
4. Maintain a supportive, non-judgmental tone throughout
5. Always end with actionable next steps and encouragement

Remember: Your goal is to help users gain self-awareness, overcome obstacles, and achieve their personal growth goals through insightful diary analysis and practical coaching guidance.

---
Analyze the following diary entry based on the instructions above:
${content}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating AI coach summary:", error);
        return "Could not generate a summary at this time.";
    }
}


/**
 * Shows an error message to the user.
 * @param {string} message - The error message to display.
 */
function showError(message: string) {
    alert(`Error: ${message}`);
}

// --- Event Handlers ---

/**
 * Handles form submission for both new and edited entries.
 * @param {Event} event - The form submission event.
 */
async function handleFormSubmit(event: Event) {
    event.preventDefault();
    const content = entryContent.value.trim();
    const userTypedTitle = entryTitle.value.trim();
    
    if (!content) return;

    const entryIdToEdit = currentlyEditingEntryId;

    toggleLoader(true);
    toggleModal(false);

    try {
        if (entryIdToEdit) {
            // Editing an existing entry
            const entryIndex = entries.findIndex(e => e.id === entryIdToEdit);
            if (entryIndex > -1) {
                const existingEntry = entries[entryIndex];
                
                // If content is unchanged, just update the title from the user's input.
                if (existingEntry.content === content) {
                    entries[entryIndex].title = userTypedTitle;
                } else {
                    // If content has changed, generate a new title, as requested.
                    const newTitle = await generateTitle(content, existingEntry.date);
                    entries[entryIndex] = {
                        ...existingEntry,
                        content: content,
                        title: newTitle,
                        coachSummary: undefined // Reset coach summary
                    };
                }
            }
        } else {
            // Creating a new entry
            const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            // Use user's title if provided, otherwise generate one.
            const title = userTypedTitle || await generateTitle(content, date);
            const newEntry: DiaryEntry = {
                id: Date.now(),
                date: date,
                title: title,
                content: content,
                status: 'active',
            };
            entries.push(newEntry);
            expandedEntryId = newEntry.id; // Expand the new entry
        }

        saveEntries();
        renderApp();
    } catch (error) {
        console.error("Failed to save entry:", error);
        showError("There was a problem saving your entry.");
    } finally {
        toggleLoader(false);
        currentlyEditingEntryId = null;
    }
}

/**
 * Moves an entry to the trash from the modal.
 */
function handleDeleteEntry() {
    if (!currentlyEditingEntryId) return;
    const entryIndex = entries.findIndex(e => e.id === currentlyEditingEntryId);
    if (entryIndex > -1) {
        entries[entryIndex].status = 'trashed';
        saveEntries();
        toggleModal(false);
        renderApp();
    }
}

/**
 * Handles the AI Coach button click. Generates and displays the summary.
 * @param {number} id - The ID of the entry.
 * @param {HTMLButtonElement} button - The button element that was clicked.
 */
async function handleAiCoach(id: number, button: HTMLButtonElement) {
    const entryIndex = entries.findIndex(e => e.id === id);
    if (entryIndex === -1) return;

    button.textContent = 'Thinking...';
    button.disabled = true;

    try {
        const entry = entries[entryIndex];
        const summary = await getAiCoachSummary(entry.content);

        // Update the entry in our state
        entries[entryIndex].coachSummary = summary;
        saveEntries();

        // Re-render the app to show the new summary
        renderApp();

    } catch (error) {
        console.error("Failed to get AI coach summary:", error);
        showError("There was a problem contacting the AI coach.");
        // Re-render to restore button state
        renderApp();
    }
}

/**
 * Restores an entry from the trash.
 * @param {number} id - The ID of the entry to restore.
 */
function handleRestoreEntry(id: number) {
    const entryIndex = entries.findIndex(e => e.id === id);
    if (entryIndex > -1) {
        entries[entryIndex].status = 'active';
        saveEntries();
        renderApp();
    }
}

/**
 * Permanently deletes an entry.
 * @param {number} id - The ID of the entry to delete.
 */
function handlePermanentDelete(id: number) {
    if (!confirm("Are you sure you want to permanently delete this entry? This action cannot be undone.")) {
        return;
    }
    entries = entries.filter(e => e.id !== id);
    saveEntries();
    renderApp();
}


/**
 * Handles navigation between views based on URL hash. Also resets search.
 */
function handleNavigation() {
    const hash = window.location.hash;
    if (hash === '#trash') {
        currentView = 'trash';
    } else {
        currentView = 'diary';
    }
    
    // Reset search and expansion when changing views
    if (searchInput) searchInput.value = '';
    searchQuery = '';
    expandedEntryId = null;
    
    renderApp();
}

// --- Event Listeners ---
addEntryBtn?.addEventListener('click', () => toggleModal(true));
cancelBtn?.addEventListener('click', () => toggleModal(false));
deleteBtn?.addEventListener('click', handleDeleteEntry);
entryForm?.addEventListener('submit', handleFormSubmit);

// Delegated event listener for main content area
entriesContainer?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // --- Handle Button Clicks ---
    const button = target.closest('button[data-id]') as HTMLButtonElement;
    if (button) {
        const id = Number(button.dataset.id);
        if (isNaN(id)) return;

        e.stopPropagation(); // Prevent card from toggling when a button is clicked

        if (button.classList.contains('edit-btn')) {
            openEditModal(id);
        } else if (button.classList.contains('ai-coach-btn')) {
            handleAiCoach(id, button);
        } else if (button.classList.contains('restore-btn')) {
            handleRestoreEntry(id);
        } else if (button.classList.contains('delete-perm-btn')) {
            handlePermanentDelete(id);
        }
        return; // Exit after handling button action
    }

    // --- Handle Header Click for expand/collapse ---
    const header = target.closest('.entry-header');
    if (header && currentView === 'diary') {
        const id = Number((header as HTMLElement).dataset.id);
        if (!isNaN(id)) {
            expandedEntryId = expandedEntryId === id ? null : id;
            renderApp();
        }
    }
});


// Search listeners
searchForm?.addEventListener('submit', (e) => e.preventDefault()); // Prevent page reload
searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderApp(); // Re-render on every keystroke
});

// Navigation button listeners
navDiaryBtn?.addEventListener('click', () => window.location.hash = 'diary');
navTrashBtn?.addEventListener('click', () => window.location.hash = 'trash');
window.addEventListener('hashchange', handleNavigation);

// Close modal if user clicks the overlay
modalOverlay?.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
        toggleModal(false);
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
        toggleModal(false);
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadEntries();
    handleNavigation();
});
