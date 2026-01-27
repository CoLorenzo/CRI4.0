const API_URL = 'http://localhost:3001/api';

const ProjectService = {
    listSaves: async () => {
        try {
            const response = await fetch(`${API_URL}/saves`);
            if (!response.ok) throw new Error("Failed to list saves");
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    saveProject: async (labInfo, machines, filename) => {
        const projectData = {
            labInfo,
            machines,
            meta: {
                version: "1.0",
                createdAt: new Date().toISOString(),
                appVersion: "4.0"
            }
        };

        try {
            const response = await fetch(`${API_URL}/saves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, data: projectData })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to save");
            }

            return { success: true, filename };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    loadProject: async (filename) => {
        try {
            const response = await fetch(`${API_URL}/saves/${filename}`);
            if (!response.ok) throw new Error("Failed to load project");

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    deleteProject: async (filename) => {
        try {
            const response = await fetch(`${API_URL}/saves/${filename}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Failed to delete project");
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

export default ProjectService;
