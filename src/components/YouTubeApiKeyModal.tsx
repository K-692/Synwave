/**
 * Synwave YouTube Data API v3 Key Setup & Validation Modal
 * 
 * Mandatory startup gate modal and on-demand key configuration dialog.
 * Validates key with a lightweight 1-unit request before accepting,
 * provides rich diagnostics for quota/permissions/format errors,
 * and masks key display for desktop security.
 */

import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Lock,
  RefreshCw,
  Clipboard,
} from 'lucide-react';
import {
  getYouTubeApiKey,
  setYouTubeApiKey,
  validateYouTubeApiKey,
  maskApiKey,
  type ApiKeyValidationResult,
} from '../services/youtubeService';

interface YouTubeApiKeyModalProps {
  isOpen: boolean;
  isMandatoryGate?: boolean;
  initialError?: string;
  onKeySaved: (validKey: string) => void;
  onClose?: () => void;
}

export const YouTubeApiKeyModal: React.FC<YouTubeApiKeyModalProps> = ({
  isOpen,
  isMandatoryGate = false,
  initialError,
  onKeySaved,
  onClose,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [currentSavedKey, setCurrentSavedKey] = useState('');
  const [showPlainKey, setShowPlainKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ApiKeyValidationResult | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const existing = getYouTubeApiKey();
      setCurrentSavedKey(existing);
      setKeyInput(existing);
      setShowPlainKey(false);

      if (initialError) {
        setValidationResult({
          isValid: false,
          errorMessage: initialError,
          errorType: 'unknown',
        });
      } else {
        setValidationResult(null);
      }
    }
  }, [isOpen, initialError]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setKeyInput(text.trim());
        setValidationResult(null);
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleValidateAndSave = async () => {
    const clean = keyInput.trim();
    if (!clean) {
      setValidationResult({
        isValid: false,
        errorType: 'invalid_key',
        errorMessage: 'Please enter or paste your Google Cloud YouTube Data API v3 key.',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    const result = await validateYouTubeApiKey(clean);
    setIsValidating(false);
    setValidationResult(result);

    if (result.isValid) {
      setYouTubeApiKey(clean);
      setCurrentSavedKey(clean);
      onKeySaved(clean);

      // Brief pause to show green success state
      setTimeout(() => {
        onClose?.();
      }, 550);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidateAndSave();
    }
  };

  const getErrorBadgeText = (type?: string) => {
    switch (type) {
      case 'invalid_key':
        return 'INVALID KEY';
      case 'quota_exhausted':
        return 'QUOTA EXHAUSTED';
      case 'api_not_enabled':
        return 'API NOT ENABLED';
      case 'forbidden':
        return 'ACCESS RESTRICTED';
      case 'network_error':
        return 'NETWORK FAILURE';
      default:
        return 'VALIDATION ERROR';
    }
  };

  return (
    <div
      className="synwave-key-modal-backdrop"
      onClick={() => {
        if (!isMandatoryGate && !isValidating) {
          onClose?.();
        }
      }}
    >
      <div
        className="synwave-key-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="key-modal-header">
          <div className="key-modal-title-wrap">
            <div className="key-icon-badge">
              <Key size={18} className="neon-cyan-icon" />
            </div>
            <div>
              <h3>YOUTUBE DATA API CONFIGURATION</h3>
              <p className="key-modal-subtitle">
                {isMandatoryGate
                  ? 'Mandatory Setup • Valid API Key Required to Unlock Stage'
                  : 'Manage & Validate Google Cloud YouTube Data API v3 Key'}
              </p>
            </div>
          </div>

          {!isMandatoryGate && onClose && (
            <button
              className="btn-icon btn-sm"
              onClick={onClose}
              disabled={isValidating}
              title="Close Dialog"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="key-modal-body">
          {isMandatoryGate && (
            <div className="key-gate-banner">
              <Lock size={15} className="gate-lock-icon" />
              <span>
                <strong>App Startup Gate:</strong> Synwave requires a verified YouTube Data API v3 key to search and synchronize official 4K stage videos.
              </span>
            </div>
          )}

          {/* Currently Configured Key Status */}
          {currentSavedKey && (
            <div className="active-key-pill">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="active-key-label">Configured Key:</span>
              <code className="active-key-code">{maskApiKey(currentSavedKey)}</code>
            </div>
          )}

          {/* Input Row */}
          <div className="key-input-container">
            <label className="key-input-label">
              <span>GOOGLE CLOUD API KEY (AIZASY...)</span>
              <button
                type="button"
                className="btn-paste-link"
                onClick={handlePaste}
                title="Paste key from clipboard"
              >
                <Clipboard size={12} />
                <span>Paste</span>
              </button>
            </label>

            <div className="key-input-wrapper">
              <input
                type={showPlainKey ? 'text' : 'password'}
                placeholder="AIzaSyC..."
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setValidationResult(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={isValidating}
                className="key-text-input"
                autoFocus={isMandatoryGate}
                autoComplete="off"
                spellCheck="false"
              />

              <button
                type="button"
                className="key-toggle-visibility"
                onClick={() => setShowPlainKey((prev) => !prev)}
                title={showPlainKey ? 'Mask API key' : 'Show plain API key'}
              >
                {showPlainKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Validation Diagnostics Alert */}
          {validationResult && !validationResult.isValid && (
            <div className={`key-error-card ${validationResult.errorType || 'unknown'}`}>
              <div className="key-error-header">
                <AlertTriangle size={16} className="key-error-icon" />
                <span className="key-error-badge">
                  {getErrorBadgeText(validationResult.errorType)}
                </span>
              </div>
              <p className="key-error-message">{validationResult.errorMessage}</p>
            </div>
          )}

          {validationResult && validationResult.isValid && (
            <div className="key-success-card">
              <Check size={16} className="text-emerald-400" />
              <span>API Key successfully verified & activated!</span>
            </div>
          )}

          {/* Step-by-Step Instructions */}
          <div className="key-guide-box">
            <div className="key-guide-title">
              <span>HOW TO GET A FREE YOUTUBE API KEY (2 MINUTES):</span>
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="key-guide-link"
              >
                <span>Google Cloud Console</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <ol className="key-guide-steps">
              <li>
                Open <strong>Google Cloud Console</strong> and create or select a project.
              </li>
              <li>
                Go to <strong>APIs & Services &gt; Library</strong>, search for <strong>YouTube Data API v3</strong>, and click <strong>Enable</strong>.
              </li>
              <li>
                Go to <strong>APIs & Services &gt; Credentials</strong>, click <strong>Create Credentials &gt; API key</strong>, copy it, and paste it above.
              </li>
            </ol>
            <div className="key-guide-note">
              Quota: Google provides 10,000 free units/day per project (zero billing required).
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="key-modal-footer">
          {!isMandatoryGate && onClose && (
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isValidating}
            >
              Cancel
            </button>
          )}

          <button
            className={`btn btn-primary key-validate-btn ${isValidating ? 'loading' : ''}`}
            onClick={handleValidateAndSave}
            disabled={isValidating || !keyInput.trim()}
          >
            {isValidating ? (
              <>
                <RefreshCw size={15} className="spinner-icon" />
                <span>Verifying with Google...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{isMandatoryGate ? 'Verify & Enter Synwave' : 'Validate & Save'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
