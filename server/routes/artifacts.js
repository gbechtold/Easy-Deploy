const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

/**
 * Artifacts API
 * CRUD operations for deployed artifacts
 */

// Get all artifacts
router.get('/', async (req, res) => {
  try {
    const artifactsPath = path.join(process.cwd(), 'artifacts');

    if (!await fs.pathExists(artifactsPath)) {
      return res.json({ artifacts: [] });
    }

    const items = await fs.readdir(artifactsPath);
    const artifacts = [];

    for (const item of items) {
      const itemPath = path.join(artifactsPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        // Check if it has package.json
        const packageJsonPath = path.join(itemPath, 'package.json');
        let packageJson = null;

        if (await fs.pathExists(packageJsonPath)) {
          packageJson = await fs.readJSON(packageJsonPath);
        }

        artifacts.push({
          name: item,
          path: itemPath,
          type: packageJson ? 'node' : 'static',
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          packageJson: packageJson ? {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description
          } : null
        });
      }
    }

    res.json({ artifacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single artifact
router.get('/:name', async (req, res) => {
  try {
    const artifactPath = path.join(process.cwd(), 'artifacts', req.params.name);

    if (!await fs.pathExists(artifactPath)) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const stats = await fs.stat(artifactPath);
    const files = await fs.readdir(artifactPath);

    res.json({
      name: req.params.name,
      path: artifactPath,
      files: files,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete artifact (requires authentication in production)
router.delete('/:name', async (req, res) => {
  try {
    const artifactPath = path.join(process.cwd(), 'artifacts', req.params.name);

    if (!await fs.pathExists(artifactPath)) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    await fs.remove(artifactPath);
    res.json({ success: true, message: 'Artifact deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
