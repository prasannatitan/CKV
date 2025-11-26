import React, { useState, useRef } from 'react';
import { ChevronDown, Paperclip, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const EXPERIENCE_OPTIONS = [
  "A moment you may not remember, but I'll never forget",
  "A lesson that changed my perspective",
  "When you showed true leadership",
  "A project that made a difference"
];

const initialFormState = {
  experience: '',
  answer: '',
  fullName: '',
  department: '',
  image: null,
  imagePreview: null
};

const StatusBanner = ({ status }) => {
  if (!status.message) return null;

  const styles = status.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : status.type === 'success'
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  const Icon = status.type === 'error' ? AlertCircle : status.type === 'success' ? CheckCircle2 : Loader2;

  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${styles}`} aria-live="polite">
      <Icon size={18} className={`mt-0.5 shrink-0 ${status.type === 'pending' ? 'animate-spin' : ''}`} />
      <p className="leading-5">{status.message}</p>
    </div>
  );
};

const ButtonLoader = ({ label }) => (
  <span className="flex items-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </span>
);

const CKVTributeApp = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (status.type === 'error') {
      setStatus({ type: 'idle', message: '' });
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: file,
          imagePreview: reader.result
        }));
      };
      reader.readAsDataURL(file);
      setErrors(prev => {
        if (!prev.image) return prev;
        const next = { ...prev };
        delete next.image;
        return next;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.experience) {
      newErrors.experience = 'Please select an experience.';
    }

    const answerText = formData.answer?.trim() || '';
    if (!answerText || answerText.length < 40) {
      newErrors.answer = 'Share at least 40 characters to bring the story to life.';
    }

    const fullName = formData.fullName?.trim() || '';
    if (!fullName || fullName.length < 3) {
      newErrors.fullName = 'Please enter your full name (minimum 3 characters).';
    }

    const department = formData.department?.trim() || '';
    if (!department || department.length < 2) {
      newErrors.department = 'Please enter a valid department.';
    }

    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      setStatus({ type: 'error', message: 'Please fix the highlighted fields before continuing.' });
      return;
    }

    const submitData = new FormData();
    submitData.append('experience', formData.experience);
    submitData.append('answer', formData.answer);
    submitData.append('fullName', formData.fullName.trim());
    submitData.append('department', formData.department.trim());
    if (formData.image) {
      submitData.append('image', formData.image);
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: 'pending', message: 'Submitting your tribute...' });
      const response = await fetch('http://localhost:5000/api/submit-tribute', {
        method: 'POST',
        body: submitData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors(prev => ({ ...prev, ...(data?.errors || {}) }));
        setStatus({ type: 'error', message: data?.message || 'Unable to submit tribute. Please try again.' });
        return;
      }

      setStatus({ type: 'success', message: 'Tribute submitted! Preview your card below.' });
      setStep(2);
    } catch (error) {
      console.error('Error submitting:', error);
      setStatus({ type: 'error', message: 'Something went wrong while submitting. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadAsImage = async () => {
    const element = previewRef.current;
    if (!element) return;

    const normalizedFullName = formData.fullName?.trim() || '';
    if (!normalizedFullName) {
      setStatus({ type: 'error', message: 'Please add your full name before downloading the preview.' });
      return;
    }
    const safeName = normalizedFullName.replace(/\s+/g, '-');

    const persistPreview = async (blob, fileName) => {
      const imageData = new FormData();
      imageData.append('image', blob, fileName);
      imageData.append('fullName', normalizedFullName);
      const response = await fetch('http://localhost:5000/api/save-preview-image', {
        method: 'POST',
        body: imageData
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Unable to save preview. Please try again.');
      }
    };

    try {
      setIsDownloading(true);
      setStatus({ type: 'pending', message: 'Preparing your preview image...' });
      element.style.backgroundSize = "cover";
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundPosition = "center";

      if (window.domtoimage) {
        const dataUrl = await window.domtoimage.toPng(element, { quality: 1 });
        const link = document.createElement('a');
        link.download = `tribute-${safeName}.png`;
        link.href = dataUrl;
        link.click();

        const blob = await (await fetch(dataUrl)).blob();
        await persistPreview(blob, link.download);
        setStatus({ type: 'success', message: 'Preview downloaded and saved successfully.' });
        return;
      }

      if (window.html2canvas) {
        const clone = element.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        document.body.appendChild(clone);

        const replaceStyles = (el) => {
          if (el.classList) {
            if (el.classList.contains('bg-gradient-to-br')) {
              el.style.background = 'linear-gradient(to bottom right, #fef3c7, #fecaca)';
            }
            if (el.classList.contains('bg-white')) el.style.backgroundColor = '#ffffff';
            if (el.classList.contains('text-gray-700')) el.style.color = '#374151';
            if (el.classList.contains('text-gray-800')) el.style.color = '#1f2937';
            if (el.classList.contains('text-gray-600')) el.style.color = '#4b5563';
            if (el.classList.contains('text-gray-500')) el.style.color = '#6b7280';
            if (el.classList.contains('text-gray-400')) el.style.color = '#9ca3af';
            if (el.classList.contains('border-gray-300')) el.style.borderColor = '#d1d5db';
            if (el.classList.contains('border-gray-400')) el.style.borderColor = '#9ca3af';
            if (el.classList.contains('border-gray-200')) el.style.borderColor = '#e5e7eb';
          }
          Array.from(el.children).forEach(child => replaceStyles(child));
        };

        replaceStyles(clone);
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await window.html2canvas(clone, {
          scale: 2,
          backgroundColor: '#ff0400ff',
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: false
        });

        document.body.removeChild(clone);

        const link = document.createElement('a');
        link.download = `tribute-${safeName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        const blob = await (await fetch(canvas.toDataURL())).blob();
        await persistPreview(blob, link.download);
        setStatus({ type: 'success', message: 'Preview downloaded and saved successfully.' });
        return;
      }

      setStatus({ type: 'error', message: 'Image libraries are missing. Please include dom-to-image or html2canvas.' });
    } catch (error) {
      console.error('Error downloading:', error);
      setStatus({ type: 'error', message: error.message || 'Unable to download preview right now.' });
    } finally {
      setIsDownloading(false);
    }
  };


  if (step === 1) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="bg-[#EFE4DE] rounded-[14px] flex items-center justify-between">
            <div className="flex-1 w-full bg-[url(/src/assets/ckv.webp)] h-[200px] bg-bottom-right bg-no-repeat bg-cover flex items-center md:justify-center ">
              <h1 className="[-webkit-text-stroke:_1px_#464646] md:text-4xl text-[25px] max-md:max-w-[150px] text-transparent mb-4 font-extrabold max-md:leading-[30px] max-md:pl-5">
                Bring Your Moments with CKV
              </h1>
            </div>
          </div>

          {status.message && <StatusBanner status={status} />}

          <div className="flex max-md:flex-col gap-8">
            {/* Left Column */}
            <div className="flex flex-col gap-10 md:p-4">
              <div>
                <p className="text-[#464646] md:text-[20px] text-[17px] md:leading-[27px] leading-[24px]">
                  Please share a deep, genuine and emotionally honest reflection for him, something that captures his people-first leadership, sustainability mindset, humility, and real impact on you.... These prompts are crafted to evoke heartfelt responses, not corporate lines.
                </p>
              </div>

              {/* Experience Selector */}
              <div className="border border-[#EFE4DE] rounded-[14px] p-6 relative">
                <label className="absolute top-[-16px] pr-1 left-[0] bg-white text-[#464646] md:text-[18px] text-[16px] font-[400] leading-[27px]">
                  Select Experience You Desire to Share
                </label>
                <div className="relative">
                  <select
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className={`w-full px-6 py-2 border-2 rounded-full appearance-none bg-[rgba(239,228,222,0.4)] text-[#464646] md:text-[16px] text-[14px] font-[400] ${errors.experience ? 'border-red-400 focus:border-red-500' : 'border-[#464646] focus:border-[#BB9472] focus:ring-2 focus:ring-[#BB9472]/30'}`}
                    aria-invalid={Boolean(errors.experience)}
                  >
                    <option value="">Select a prompt...</option>
                    {EXPERIENCE_OPTIONS.map((exp) => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
                {errors.experience && <p className="mt-2 text-sm text-red-600">{errors.experience}</p>}
              </div>

              {/* Answer Text Area */}
              <div className="relative">
                <label className='absolute bg-white mt-[-13px] z-10 pr-1 text-[#464646] md:text-[18px] text-[16px] leading-[27px]'>Answer for Q1</label>
                <div className="absolute z-2 inset-0 pointer-events-none p-6 pt-0 border border-[#EFE4DE] rounded-[14px]">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="border-b border-dashed border-[rgba(70,70,70,0.46)]"
                      style={{ height: '30px' }}
                    />
                  ))}
                </div>

                <textarea
                  name='answer'
                  value={formData.answer}
                  onChange={handleInputChange}
                  className={`p-6 pt-8 w-full h-60 bg-transparent relative z-10 resize-none focus:outline-none text-[#464646] md:text-[16px] text-[14px] font-[400] leading-10 ${errors.answer ? 'border border-red-400 rounded-[14px]' : ''}`}
                  style={{ lineHeight: '30px' }}
                  placeholder="Start typing your answer..."
                  aria-invalid={Boolean(errors.answer)}
                />
                {errors.answer && <p className="mt-2 text-sm text-red-600">{errors.answer}</p>}
              </div>
            </div>

            {/* Right Column */}
            <div className="md:min-w-[400px] md:p-4 flex flex-col justify-between gap-8">
              <div>
                <p className="text-[#464646] md:text-[20px] text-[17px] md:leading-[27px] leading-[24px]">
                  Is there a memory with CKV that captures what he means to you? A place...a project or
                </p>
              </div>

              {/* Image Upload */}
              <div className="border border-[#EFE4DE] rounded-[14px] p-6 relative">
                <label className="absolute top-[-16px] pr-1 left-[0] bg-white text-[#464646] md:text-[18px] text-[16px] font-[400] leading-[27px]">
                  Upload Your Project or Memory
                </label>
                <label className={`flex items-center justify-center w-full px-6 py-4 border-2 rounded-full appearance-none bg-[rgba(239,228,222,0.4)] text-[#464646] md:text-[16px] text-[14px] font-[400] ${errors.image ? 'border-red-400' : 'border-[#464646]'}`}>
                  <Paperclip className="mr-2" size={20} />
                  <span className="text-gray-600 ">
                    {formData.image ? formData.image.name : 'Attach Picture'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {formData.imagePreview && (
                  <div className="mt-4 rounded-2xl overflow-hidden">
                    <img src={formData.imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                  </div>
                )}
                {errors.image && <p className="mt-2 text-sm text-red-600">{errors.image}</p>}
              </div>

              {/* Form Fields */}
              <div className="border border-[#EFE4DE] rounded-[14px] p-6 relative flex flex-col gap-4">
                <label className="absolute top-[-16px] pr-1 left-[0] bg-white text-[#464646] md:text-[18px] text-[16px] font-[400] leading-[27px]">
                  Fill The Form
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Type Your Full Name Here"
                  className={`w-full px-6 py-4 border-2 rounded-full appearance-none bg-[rgba(239,228,222,0.4)]  text-[#464646] md:text-[16px] text-[14px] font-[400] ${errors.fullName ? 'border-red-400 focus:border-red-500' : 'border-[#464646] focus:border-[#BB9472]'}`}
                  aria-invalid={Boolean(errors.fullName)}
                />
                {errors.fullName && <p className="text-sm text-red-600">{errors.fullName}</p>}
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="Department"
                  className={`w-full px-6 py-4 border-2 rounded-full appearance-none bg-[rgba(239,228,222,0.4)]  text-[#464646] md:text-[16px] text-[14px] font-[400] ${errors.department ? 'border-red-400 focus:border-red-500' : 'border-[#464646] focus:border-[#BB9472]'}`}
                  aria-invalid={Boolean(errors.department)}
                />
                {errors.department && <p className="text-sm text-red-600">{errors.department}</p>}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-3 border-2 border-[#464646] rounded-full appearance-none bg-[#EFE4DE] hover:bg-[#fde1d1] cursor-pointer text-[#464646] text-[22px] font-[600] flex gap-4 items-center justify-center max-w-[290px] mx-auto mt-8 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? <ButtonLoader label="Submitting..." /> : (
            <>
              Submit Your Responses
              <svg width="10" height="17" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.52917 7.29233C9.44505 7.20634 9.35256 7.13438 9.25617 7.07126L2.78783 0.48209C2.15653 -0.160392 1.1331 -0.161002 0.5015 0.48209C-0.129201 1.12518 -0.1298 2.16742 0.5015 2.81112L6.07214 8.48521L0.473362 14.1895C-0.157638 14.8326 -0.157937 15.8748 0.473362 16.5182C0.789461 16.8393 1.20284 17.0006 1.61623 17C2.02991 17.0006 2.44359 16.8393 2.75849 16.5176L9.25587 9.89977C9.35256 9.83665 9.44475 9.76407 9.52917 9.67747C9.85185 9.34876 10.0072 8.91638 9.99972 8.48521C10.0075 8.05465 9.85185 7.62105 9.52917 7.29233Z" fill="#464646" />
              </svg>
            </>
          )}
        </button>
      </div>
    );
  }

  // Preview Page (Step 2)
  return (
    <div className="py-5 px-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <h1 className="text-[33px] text-center text-[#464646]">Preview Your Response</h1>
        {status.message && <StatusBanner status={status} />}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => {
              setStatus({ type: 'idle', message: '' });
              setStep(1);
            }}
            className="w-full  py-3 border-2 border-[#464646] rounded-full appearance-none cursor-pointer text-[#464646] text-[20px] font-[600] flex gap-4 items-center justify-center max-w-[90px]"
          >
            Edit
          </button>
          <button
            onClick={downloadAsImage}
            disabled={isDownloading}
            className={`w-full py-3 border-2 border-[#464646] rounded-full appearance-none bg-[#EFE4DE] hover:bg-[#fde1d1] cursor-pointer text-[#464646] text-[20px] font-[600] flex gap-4 items-center justify-center max-w-[200px] ${isDownloading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isDownloading ? <ButtonLoader label="Generating..." /> : (
              <>
                Download
                <svg width="10" height="15" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.52917 7.29233C9.44505 7.20634 9.35256 7.13438 9.25617 7.07126L2.78783 0.48209C2.15653 -0.160392 1.1331 -0.161002 0.5015 0.48209C-0.129201 1.12518 -0.1298 2.16742 0.5015 2.81112L6.07214 8.48521L0.473362 14.1895C-0.157638 14.8326 -0.157937 15.8748 0.473362 16.5182C0.789461 16.8393 1.20284 17.0006 1.61623 17C2.02991 17.0006 2.44359 16.8393 2.75849 16.5176L9.25587 9.89977C9.35256 9.83665 9.44475 9.76407 9.52917 9.67747C9.85185 9.34876 10.0072 8.91638 9.99972 8.48521C10.0075 8.05465 9.85185 7.62105 9.52917 7.29233Z" fill="#464646"/>
</svg>
              </>
            )}
          </button>
        </div>

        {/* Preview Card */}
        <div
          ref={previewRef}
          className="p-12 pt-5 relative overflow-hidden bg-[url('/src/assets/bg-img.webp')] bg-cover"
        >


          <div className="relative z-10">
            {/* From field */}
            <div className="text-right mb-8">
              <span className="sloop text-[50px] text-[#BB9472] font-[400]">From </span>
              <span className="text-center min-w-[150px] text-[19px] text-[#464646] italic border-dashed border-b-1 border-[#464646] inline-block mt-[-2px]">
                {formData.fullName || ' '}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Image */}
              <div className="flex items-center justify-center">
                <div className="w-[350px] aspect-square bg-white overflow-hidden ">
                  {formData.imagePreview ? (
                    <img src={formData.imagePreview} alt="Memory" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="w-32 h-32 mx-auto mb-4 border-4 border-gray-300 rounded-lg flex items-center justify-center">
                          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Content */}
              <div className='mt-4'>
                <img src="/src/assets/text.png" alt="" />
                <div className="relative mt-2 max-w-[340px] mx-auto">
                  <p className="absolute top-0 pt-1 text-[20px] text-[#464646] italic leading-[10px]" style={{ lineHeight: '30px' }}>
                    {formData.answer || 'text will come here'}
                  </p>
                  {[...Array(11)].map((_, i) => (
                    <div key={i} className="m-0 border-b border-dashed border-[#464646]"
                      style={{ height: '30px' }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CKVTributeApp;