import React, { useState, useRef } from 'react';
import { ChevronDown, Paperclip, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const EXPERIENCE_OPTIONS = [
  "A belief or skill I carry forward thanks to you",
  "A moment of support you offered when it was needed most",
  "A moment you may not remember, but I’ll never forget",
  "What we discovered together",
  "One value I learnt from you",
  "Type My own"
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CKVTributeApp = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const previewRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'experience') {
      const isCustomOption = value === 'Type My own';
      setShowCustomInput(isCustomOption);
      formData.experience = ""
      if (!isCustomOption) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
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

  const handleCustomInputChange = (e) => {
    setFormData(prev => ({ ...prev, experience: e.target.value }));
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
      setStatus({ type: 'pending', message: 'Submitting your details...' });
      const response = await fetch(`${API_BASE_URL}/api/submit-tribute`, {
        method: 'POST',
        body: submitData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors(prev => ({ ...prev, ...(data?.errors || {}) }));
        setStatus({ type: 'error', message: data?.message || 'Unable to submit your details. Please try again.' });
        return;
      }

      setStatus({ type: 'success', message: 'details submitted! Preview your card below.' });
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
      const response = await fetch(`${API_BASE_URL}/api/save-preview-image`, {
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

      if (window.domtoimage) {
        const dataUrl = await window.domtoimage.toPng(element, { quality: 1 });
        const link = document.createElement('a');
        link.download = `pre-${safeName}.png`;
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
        link.download = `pre-${safeName}.png`;
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
        <div className="max-w-6xl mx-auto flex flex-col gap-10">
          {/* Header */}
          <div className="bg-[#EFE4DE] rounded-[14px] flex items-center justify-between">
            <div className="flex-1 w-full bg-[url(/src/assets/ckv.webp)] h-[200px] bg-bottom-right bg-no-repeat bg-cover flex items-center md:justify-center ">
              <h1 className="[-webkit-text-stroke:_1px_#464646] md:text-4xl text-[25px] max-md:max-w-[150px] text-transparent mb-4 font-extrabold max-md:leading-[30px] max-md:pl-5">
                Memories You Share With CKV
              </h1>
            </div>
          </div>

          {status.message && <StatusBanner status={status} />}

          <div className="flex max-md:flex-col gap-8">
            {/* Left Column */}
            <div className="flex flex-col gap-10 md:p-4 relative">
              <img className='z-1 absolute top-[-16px] left-[-5px] w-[52px]' src="/assets/q1.png" alt="" />
              <div className='z-10 relative'>
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
                    value={showCustomInput ? 'Type My own' : formData.experience}
                    onChange={handleInputChange}
                    className={`w-full px-6 py-2 border-2 rounded-full appearance-none bg-[rgba(239,228,222,0.4)] text-[#464646] md:text-[16px] text-[14px] font-[400] ${errors.experience ? 'border-red-400 focus:border-red-500' : 'border-[#464646] focus:border-[#BB9472] focus:ring-2 focus:ring-[#BB9472]/30'}`}
                    aria-invalid={Boolean(errors.experience)}
                  >
                    <option value="">Select a Experience...</option>
                    {EXPERIENCE_OPTIONS.map((exp) => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                  <svg className="absolute right-6 top-6 -translate-y-1/2 text-gray-400" width="17" height="11" viewBox="0 0 17 11" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.70767 9.70717C9.79366 9.62148 9.86562 9.52726 9.92874 9.42908L16.5179 2.8399C17.1604 2.19681 17.161 1.15426 16.5179 0.510867C15.8748 -0.131614 14.8326 -0.132224 14.1889 0.510867L8.51479 6.18556L2.81052 0.482204C2.16742 -0.160582 1.12518 -0.160887 0.481787 0.482204C0.160698 0.804208 -0.000608132 1.22531 1.72277e-06 1.64642C-0.000608132 2.06783 0.160698 2.48924 0.482397 2.81002L7.10023 9.42877C7.16335 9.52726 7.23593 9.62118 7.32253 9.70717C7.65124 10.0359 8.08362 10.1941 8.51479 10.1865C8.94535 10.1944 9.37895 10.0359 9.70767 9.70717Z" fill="#464646"/>
</svg>

                  {showCustomInput && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={formData.experience}
                        onChange={handleCustomInputChange}
                        placeholder="Enter your custom experience..."
                        className="w-full px-6 py-2 border-2 rounded-full bg-[rgba(239,228,222,0.4)] text-[#464646] md:text-[16px] text-[14px] font-[400] border-[#464646] focus:border-[#BB9472] focus:ring-2 focus:ring-[#BB9472]/30"
                      />
                    </div>
                  )}
              
                </div>
                {errors.experience && <p className="mt-2 text-sm text-red-600">{errors.experience}</p>}
              </div>

              {/* Answer Text Area */}
              <div className="relative">
                <label className='absolute bg-white mt-[-13px] z-10 pr-1 text-[#464646] md:text-[18px] text-[16px] leading-[27px]'>Your Experience</label>
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
                  className={`!border-none p-6 pt-8 w-full h-60 bg-transparent relative z-10 resize-none focus:outline-none text-[#464646] md:text-[16px] text-[14px] font-[400] leading-10 ${errors.answer ? 'border border-red-400 rounded-[14px]' : ''}`}
                  style={{ lineHeight: '30px' }}
                  placeholder="Start typing your answer..."
                  aria-invalid={Boolean(errors.answer)}
                />
                {errors.answer && <p className="pl-6 mt-2 text-sm text-red-600">{errors.answer}</p>}
              </div>
            </div>

            {/* Right Column */}
            <div className="relative md:min-w-[400px] md:p-4 flex flex-col justify-between gap-8">
               <img className='z-1 absolute top-[-14px] left-[-7px] w-[55px]' src="assets/q2.png" alt="" />
              <div className='relative z-10'>
                <p className="text-[#464646] md:text-[20px] text-[17px] md:leading-[27px] leading-[24px]">
                  Is there a memory with CKV that captures what he means to you?
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
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
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
          className="bg-white"
        >


          <div className="relative z-10 md:p-12 md:pt-6 p-2 pt-5 relative overflow-hidden bg-[url('/src/assets/pre-bg.png')] bg-contain bg-no-repeat">
            {/* From field */}
            <div className="text-right md:mb-8 mb-2 relative" >
              <span className="sloop text-[50px] text-[#BB9472] font-[400]">From </span>
              <span className="text-left min-w-[150px] text-[19px] text-[#464646] italic border-dashed border-b-1 border-[#464646] inline-block mt-[-2px]">
                {formData.fullName || ' '}
              </span><br/>
              <span className='absolute text-left right-0 bottom-[-10px]  min-w-[150px] text-[19px] text-[#464646] italic'>
                {formData.department}
              </span>
            </div>

            <div className="grid md:grid-cols-2 md:gap-8 gap-4">
              {/* Image */}
              <div className="flex items-center justify-center">
                <div className="md:w-[350px] w-full aspect-square bg-white overflow-hidden ">
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
              <div className=''>
              {/* <svg width="100%" height="55" viewBox="0 0 461 55" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M124.689 44.9998C121.898 44.9998 119.739 43.8465 118.212 41.54C116.709 39.2336 115.958 35.9981 115.958 31.8336C115.958 27.3167 116.674 23.921 118.105 21.6466C119.536 19.3721 121.552 18.2349 124.153 18.2349C126.538 18.2349 128.411 19.2119 129.771 21.166C131.154 23.0881 131.846 25.9552 131.846 29.7673V30.9206H120.002C120.002 34.1561 120.169 36.7829 120.503 38.8011C120.837 40.7872 121.373 42.2448 122.113 43.1738C122.852 44.0708 123.819 44.5193 125.011 44.5193C125.894 44.5193 126.681 44.295 127.373 43.8465C128.065 43.366 128.649 42.6613 129.127 41.7323C129.604 40.8032 129.926 39.634 130.093 38.2245C130.427 38.3206 130.665 38.5448 130.808 38.8972C130.975 39.2175 131.059 39.5859 131.059 40.0024C131.059 40.7071 130.82 41.46 130.343 42.2608C129.89 43.0297 129.186 43.6864 128.232 44.231C127.302 44.7435 126.121 44.9998 124.689 44.9998ZM127.731 30.4401C127.731 27.589 127.612 25.3145 127.373 23.6167C127.135 21.9188 126.753 20.6855 126.228 19.9167C125.703 19.1158 124.999 18.7154 124.117 18.7154C123.186 18.7154 122.423 19.1158 121.827 19.9167C121.254 20.6855 120.825 21.9188 120.538 23.6167C120.252 25.3145 120.073 27.589 120.002 30.4401H127.731Z" fill="#BB9472"/>
<path d="M85.5717 13.2377C85.4286 12.597 85.2497 12.1005 85.0349 11.7481C84.8441 11.3637 84.5817 11.0914 84.2477 10.9312C83.9376 10.7711 83.532 10.691 83.031 10.691H82.709V10.2104H93.1221V10.691H92.156C91.4164 10.691 90.8678 10.8511 90.5099 11.1715C90.1759 11.4598 90.0089 11.9724 90.0089 12.7091C90.0089 12.9014 90.0209 13.1256 90.0447 13.3819C90.0686 13.6061 90.1044 13.8624 90.1521 14.1507C90.2236 14.439 90.2833 14.7273 90.331 15.0156L93.8736 30.8728C94.1122 31.9299 94.3388 33.0031 94.5535 34.0923C94.7682 35.1494 94.971 36.2386 95.1618 37.3598C95.3527 38.481 95.5435 39.6503 95.7344 40.8676C95.8537 40.0026 96.0207 38.9615 96.2354 37.7442C96.4739 36.5269 96.7244 35.2135 96.9868 33.8039L101.352 10.5468H103.142L108.187 30.6806C108.521 31.9299 108.831 33.2113 109.118 34.5247C109.404 35.8381 109.666 37.0715 109.905 38.2247C110.143 39.378 110.334 40.355 110.477 41.1559C110.644 40.291 110.788 39.4901 110.907 38.7533C111.026 38.0165 111.157 37.2637 111.3 36.4949C111.467 35.726 111.634 34.8611 111.801 33.9001L115.344 15.5442C115.439 14.9996 115.511 14.5191 115.559 14.1027C115.606 13.6862 115.63 13.3178 115.63 12.9975C115.63 12.1325 115.439 11.5399 115.058 11.2195C114.676 10.8672 114.068 10.691 113.233 10.691H112.123V10.2104H119.423V10.691H118.636C118.135 10.691 117.718 10.8031 117.384 11.0273C117.05 11.2516 116.763 11.636 116.525 12.1806C116.31 12.7252 116.107 13.478 115.917 14.439L110.191 44.5195H107.507L100.637 16.4091L95.4481 44.5195H92.6212L85.5717 13.2377Z" fill="#BB9472"/>
<path d="M77.7774 45C76.0121 45 74.7 44.4554 73.8412 43.3662C72.9824 42.245 72.5529 40.2909 72.5529 37.5039V19.2442H69.8691V18.7637C70.7995 18.7637 71.6106 18.6515 72.3025 18.4273C73.0181 18.171 73.6265 17.7866 74.1274 17.2741C74.6523 16.7615 75.0698 16.1048 75.3799 15.3039C75.7139 14.471 75.9644 13.478 76.1314 12.3247H76.4892V18.7637H81.3916V19.2442H76.4892V39.3779C76.4892 41.0117 76.7158 42.229 77.1691 43.0299C77.6462 43.8308 78.338 44.2312 79.2446 44.2312C79.5785 44.2312 79.9245 44.1831 80.2823 44.087C80.664 43.9909 81.0576 43.8468 81.4632 43.6546V44.1351C81.153 44.3273 80.6521 44.5195 79.9602 44.7117C79.2684 44.9039 78.5408 45 77.7774 45Z" fill="#BB9472"/>
<path d="M60.1629 44.9998C58.3737 44.9998 56.9542 44.3591 55.9046 43.0777C54.8549 41.7643 54.3301 40.0024 54.3301 37.792C54.3301 35.3253 54.9981 33.4994 56.334 32.3141C57.6699 31.1288 59.7096 30.4721 62.4531 30.344L65.3873 30.1998V25.9232C65.3873 24.2253 65.3158 22.8478 65.1726 21.7907C65.0295 20.7336 64.7432 19.9647 64.3138 19.4842C63.8844 18.9717 63.2403 18.7154 62.3815 18.7154C61.1171 18.7154 60.2941 19.292 59.9124 20.4453C59.5307 21.5665 59.3398 23.4245 59.3398 26.0193C58.1948 26.0193 57.324 25.795 56.7276 25.3465C56.1312 24.866 55.833 24.0972 55.833 23.0401C55.833 21.8868 56.1312 20.9578 56.7276 20.253C57.3479 19.5483 58.159 19.0357 59.1609 18.7154C60.1867 18.395 61.308 18.2349 62.5246 18.2349C64.791 18.2349 66.4847 18.8595 67.606 20.1089C68.7511 21.3582 69.3236 23.4885 69.3236 26.4998V40.8673C69.3236 41.6682 69.3952 42.3089 69.5383 42.7894C69.6814 43.2379 69.92 43.5582 70.254 43.7504C70.588 43.9426 71.0174 44.0387 71.5422 44.0387H71.6496V44.5193H65.6378V39.5219H65.5663C65.3039 40.8353 64.9102 41.8924 64.3854 42.6933C63.8606 43.4942 63.2403 44.0868 62.5246 44.4712C61.8089 44.8236 61.0217 44.9998 60.1629 44.9998ZM61.2006 44.1348C62.0356 44.1348 62.7632 43.8145 63.3834 43.1738C64.0276 42.5331 64.5166 41.7002 64.8506 40.6751C65.2084 39.618 65.3873 38.4807 65.3873 37.2634V30.7284L63.2761 30.8245C61.4153 30.9526 60.1271 31.5613 59.4114 32.6504C58.7196 33.7396 58.3737 35.5656 58.3737 38.1284C58.3737 39.4738 58.4691 40.595 58.66 41.492C58.8747 42.389 59.1967 43.0617 59.6261 43.5102C60.0555 43.9266 60.5804 44.1348 61.2006 44.1348Z" fill="#BB9472"/>
<path d="M34.1289 44.5195V44.0389H34.451C35.0712 44.0389 35.5961 43.9268 36.0255 43.7026C36.4549 43.4463 36.765 43.0299 36.9558 42.4532C37.1706 41.8766 37.2779 41.0437 37.2779 39.9545V12.4208C37.2779 11.3957 37.1706 10.6108 36.9558 10.0662C36.7411 9.48961 36.431 9.08918 36.0255 8.86494C35.6438 8.60866 35.1309 8.48052 34.4867 8.48052H34.2363V8H41.2141V17.7065C41.2141 18.3151 41.2141 18.9238 41.2141 19.5325C41.2141 20.1411 41.2141 20.7498 41.2141 21.3584C41.2141 21.9671 41.2022 22.5918 41.1784 23.2325H41.2499C41.5601 21.7589 42.0014 20.6697 42.5739 19.9649C43.1703 19.2602 43.8145 18.7957 44.5063 18.5714C45.222 18.3472 45.8899 18.2351 46.5102 18.2351C48.6095 18.2351 50.1721 18.9879 51.1979 20.4935C52.2476 21.9671 52.7724 24.3377 52.7724 27.6052V39.9065C52.7724 40.9957 52.8559 41.8446 53.0229 42.4532C53.1899 43.0299 53.4642 43.4463 53.8459 43.7026C54.2515 43.9268 54.7644 44.0389 55.3846 44.0389H55.5278V44.5195H48.8362V26.0195C48.8362 23.9372 48.5737 22.2714 48.0489 21.0221C47.5241 19.7727 46.6175 19.148 45.3293 19.148C44.2796 19.148 43.4566 19.5485 42.8602 20.3493C42.2638 21.1502 41.8344 22.2074 41.572 23.5208C41.3334 24.8022 41.2141 26.1796 41.2141 27.6532V39.9545C41.2141 41.0437 41.3096 41.8766 41.5004 42.4532C41.7151 43.0299 42.0253 43.4463 42.4308 43.7026C42.8602 43.9268 43.3731 44.0389 43.9695 44.0389H44.22V44.5195H34.1289Z" fill="#BB9472"/>
<path d="M2.86272 13.2377C2.71959 12.597 2.54067 12.1005 2.32596 11.7481C2.13511 11.3637 1.8727 11.0914 1.53871 10.9312C1.22859 10.7711 0.823033 10.691 0.322056 10.691H0V10.2104H10.4132V10.691H9.44699C8.70745 10.691 8.15876 10.8511 7.80092 11.1715C7.46694 11.4598 7.29995 11.9724 7.29995 12.7091C7.29995 12.9014 7.31187 13.1256 7.33573 13.3819C7.35959 13.6061 7.39537 13.8624 7.44308 14.1507C7.51465 14.439 7.57429 14.7273 7.622 15.0156L11.1646 30.8728C11.4032 31.9299 11.6298 33.0031 11.8445 34.0923C12.0592 35.1494 12.262 36.2386 12.4528 37.3598C12.6437 38.481 12.8345 39.6503 13.0254 40.8676C13.1447 40.0026 13.3117 38.9615 13.5264 37.7442C13.7649 36.5269 14.0154 35.2135 14.2778 33.8039L18.6435 10.5468H20.4327L25.4782 30.6806C25.8122 31.9299 26.1224 33.2113 26.4086 34.5247C26.6949 35.8381 26.9573 37.0715 27.1959 38.2247C27.4344 39.378 27.6253 40.355 27.7684 41.1559C27.9354 40.291 28.0786 39.4901 28.1978 38.7533C28.3171 38.0165 28.4483 37.2637 28.5915 36.4949C28.7584 35.726 28.9254 34.8611 29.0924 33.9001L32.6351 15.5442C32.7305 14.9996 32.802 14.5191 32.8498 14.1027C32.8975 13.6862 32.9213 13.3178 32.9213 12.9975C32.9213 12.1325 32.7305 11.5399 32.3488 11.2195C31.9671 10.8672 31.3588 10.691 30.5238 10.691H29.4145V10.2104H36.7144V10.691H35.9272C35.4262 10.691 35.0087 10.8031 34.6747 11.0273C34.3408 11.2516 34.0545 11.636 33.8159 12.1806C33.6012 12.7252 33.3984 13.478 33.2076 14.439L27.4822 44.5195H24.7983L17.9278 16.4091L12.7391 44.5195H9.91218L2.86272 13.2377Z" fill="#BB9472"/>
<path d="M440.225 44.2V43.75H440.765C441.545 43.75 442.19 43.645 442.7 43.435C443.24 43.225 443.645 42.88 443.915 42.4C444.185 41.92 444.32 41.26 444.32 40.42V23.815C444.32 23.005 444.185 22.36 443.915 21.88C443.645 21.4 443.24 21.055 442.7 20.845C442.19 20.635 441.545 20.53 440.765 20.53H440.63V20.08H449.225V24.4H449.315C449.555 23.56 449.9 22.78 450.35 22.06C450.83 21.34 451.49 20.755 452.33 20.305C453.17 19.825 454.265 19.585 455.615 19.585C457.175 19.585 458.36 19.9 459.17 20.53C459.98 21.13 460.385 21.985 460.385 23.095C460.385 24.115 460.01 24.94 459.26 25.57C458.51 26.2 457.355 26.515 455.795 26.515C455.795 24.535 455.495 23.17 454.895 22.42C454.325 21.67 453.65 21.295 452.87 21.295C452.12 21.295 451.505 21.55 451.025 22.06C450.545 22.57 450.17 23.26 449.9 24.13C449.66 25 449.495 25.93 449.405 26.92C449.315 27.91 449.27 28.915 449.27 29.935V40.285C449.27 41.155 449.405 41.845 449.675 42.355C449.945 42.865 450.35 43.225 450.89 43.435C451.43 43.645 452.075 43.75 452.825 43.75H453.635V44.2H440.225Z" fill="#BB9472"/>
<path d="M433.028 44.65C429.518 44.65 426.803 43.57 424.883 41.41C422.993 39.25 422.048 36.22 422.048 32.32C422.048 28.09 422.948 24.91 424.748 22.78C426.548 20.65 429.083 19.585 432.353 19.585C435.353 19.585 437.708 20.5 439.418 22.33C441.158 24.13 442.028 26.815 442.028 30.385V31.465H427.133C427.133 34.495 427.343 36.955 427.763 38.845C428.183 40.705 428.858 42.07 429.788 42.94C430.718 43.78 431.933 44.2 433.433 44.2C434.543 44.2 435.533 43.99 436.403 43.57C437.273 43.12 438.008 42.46 438.608 41.59C439.208 40.72 439.613 39.625 439.823 38.305C440.243 38.395 440.543 38.605 440.723 38.935C440.933 39.235 441.038 39.58 441.038 39.97C441.038 40.63 440.738 41.335 440.138 42.085C439.568 42.805 438.683 43.42 437.483 43.93C436.313 44.41 434.828 44.65 433.028 44.65ZM436.853 31.015C436.853 28.345 436.703 26.215 436.403 24.625C436.103 23.035 435.623 21.88 434.963 21.16C434.303 20.41 433.418 20.035 432.308 20.035C431.138 20.035 430.178 20.41 429.428 21.16C428.708 21.88 428.168 23.035 427.808 24.625C427.448 26.215 427.223 28.345 427.133 31.015H436.853Z" fill="#BB9472"/>
<path d="M396.463 44.2V43.75H396.868C397.648 43.75 398.308 43.645 398.848 43.435C399.388 43.195 399.778 42.805 400.018 42.265C400.288 41.725 400.423 40.945 400.423 39.925V14.14C400.423 13.18 400.288 12.445 400.018 11.935C399.748 11.395 399.358 11.02 398.848 10.81C398.368 10.57 397.723 10.45 396.913 10.45H396.598V10H405.373V19.09C405.373 19.66 405.373 20.23 405.373 20.8C405.373 21.37 405.373 21.94 405.373 22.51C405.373 23.08 405.358 23.665 405.328 24.265H405.418C405.808 22.885 406.363 21.865 407.083 21.205C407.833 20.545 408.643 20.11 409.513 19.9C410.413 19.69 411.253 19.585 412.033 19.585C414.673 19.585 416.638 20.29 417.928 21.7C419.248 23.08 419.908 25.3 419.908 28.36V39.88C419.908 40.9 420.013 41.695 420.223 42.265C420.433 42.805 420.778 43.195 421.258 43.435C421.768 43.645 422.413 43.75 423.193 43.75H423.373V44.2H414.958V26.875C414.958 24.925 414.628 23.365 413.968 22.195C413.308 21.025 412.168 20.44 410.548 20.44C409.228 20.44 408.193 20.815 407.443 21.565C406.693 22.315 406.153 23.305 405.823 24.535C405.523 25.735 405.373 27.025 405.373 28.405V39.925C405.373 40.945 405.493 41.725 405.733 42.265C406.003 42.805 406.393 43.195 406.903 43.435C407.443 43.645 408.088 43.75 408.838 43.75H409.153V44.2H396.463Z" fill="#BB9472"/>
<path d="M394.925 44.6498C392.705 44.6498 391.054 44.1398 389.974 43.1198C388.894 42.0698 388.354 40.2398 388.354 37.6298V20.5298H384.979V20.0798C386.149 20.0798 387.169 19.9748 388.039 19.7648C388.939 19.5248 389.704 19.1648 390.334 18.6848C390.994 18.2048 391.519 17.5898 391.909 16.8398C392.329 16.0598 392.644 15.1298 392.854 14.0498H393.305V20.0798H399.47V20.5298H393.305V39.3848C393.305 40.9148 393.59 42.0548 394.16 42.8048C394.76 43.5548 395.629 43.9298 396.769 43.9298C397.189 43.9298 397.624 43.8848 398.074 43.7948C398.554 43.7048 399.05 43.5698 399.56 43.3898V43.8398C399.17 44.0198 398.54 44.1998 397.67 44.3798C396.8 44.5598 395.885 44.6498 394.925 44.6498Z" fill="#BB9472"/>
<path d="M377.874 44.65C374.364 44.65 371.649 43.57 369.729 41.41C367.839 39.25 366.894 36.22 366.894 32.32C366.894 28.09 367.794 24.91 369.594 22.78C371.394 20.65 373.929 19.585 377.199 19.585C380.199 19.585 382.554 20.5 384.264 22.33C386.004 24.13 386.874 26.815 386.874 30.385V31.465H371.979C371.979 34.495 372.189 36.955 372.609 38.845C373.029 40.705 373.704 42.07 374.634 42.94C375.564 43.78 376.779 44.2 378.279 44.2C379.389 44.2 380.379 43.99 381.249 43.57C382.119 43.12 382.854 42.46 383.454 41.59C384.054 40.72 384.459 39.625 384.669 38.305C385.089 38.395 385.389 38.605 385.569 38.935C385.779 39.235 385.884 39.58 385.884 39.97C385.884 40.63 385.584 41.335 384.984 42.085C384.414 42.805 383.529 43.42 382.329 43.93C381.159 44.41 379.674 44.65 377.874 44.65ZM381.699 31.015C381.699 28.345 381.549 26.215 381.249 24.625C380.949 23.035 380.469 21.88 379.809 21.16C379.149 20.41 378.264 20.035 377.154 20.035C375.984 20.035 375.024 20.41 374.274 21.16C373.554 21.88 373.014 23.035 372.654 24.625C372.294 26.215 372.069 28.345 371.979 31.015H381.699Z" fill="#BB9472"/>
<path d="M355.42 55.0002C352.15 55.0002 349.72 54.4602 348.13 53.3802C346.54 52.3302 345.745 50.9052 345.745 49.1052C345.745 48.0852 345.985 47.2002 346.465 46.4502C346.975 45.7302 347.74 45.1452 348.76 44.6952C349.81 44.2752 351.145 44.0502 352.765 44.0202C351.475 43.6902 350.485 43.1052 349.795 42.2652C349.135 41.4252 348.805 40.5102 348.805 39.5202C348.805 38.5602 349.12 37.6902 349.75 36.9102C350.41 36.1002 351.4 35.4702 352.72 35.0202C351.22 34.5102 350.02 33.6552 349.12 32.4552C348.25 31.2552 347.815 29.7402 347.815 27.9102C347.815 25.3302 348.535 23.3052 349.975 21.8352C351.445 20.3352 353.635 19.5852 356.545 19.5852C357.625 19.5852 358.6 19.7202 359.47 19.9902C360.37 20.2602 361.165 20.6502 361.855 21.1602C362.395 20.5302 363.025 19.9452 363.745 19.4052C364.465 18.8652 365.32 18.5952 366.31 18.5952C367.21 18.5952 367.885 18.8352 368.335 19.3152C368.785 19.7652 369.01 20.3352 369.01 21.0252C369.01 21.6252 368.815 22.1502 368.425 22.6002C368.035 23.0202 367.36 23.2302 366.4 23.2302C366.4 22.3002 366.235 21.6102 365.905 21.1602C365.575 20.7102 365.065 20.4852 364.375 20.4852C364.015 20.4852 363.67 20.5602 363.34 20.7102C363.04 20.8302 362.665 21.0702 362.215 21.4302C363.085 22.1802 363.745 23.1102 364.195 24.2202C364.675 25.3002 364.915 26.5002 364.915 27.8202C364.915 30.0702 364.225 31.9302 362.845 33.4002C361.495 34.8702 359.395 35.6052 356.545 35.6052C355.945 35.6052 355.375 35.5752 354.835 35.5152C354.295 35.4252 353.77 35.3202 353.26 35.2002C352.6 35.5002 352.135 35.8452 351.865 36.2352C351.625 36.6252 351.505 37.0602 351.505 37.5402C351.505 38.2902 351.76 38.8452 352.27 39.2052C352.81 39.5352 353.635 39.7002 354.745 39.7002H359.92C362.68 39.7002 364.66 40.3302 365.86 41.5902C367.06 42.8502 367.66 44.4852 367.66 46.4952C367.66 49.1052 366.67 51.1752 364.69 52.7052C362.71 54.2352 359.62 55.0002 355.42 55.0002ZM355.825 54.5502C358.525 54.5502 360.55 54.0552 361.9 53.0652C363.28 52.0752 363.97 50.5902 363.97 48.6102C363.97 47.1402 363.58 46.0452 362.8 45.3252C362.02 44.6052 360.82 44.2452 359.2 44.2452H354.385C353.515 44.2452 352.72 44.3952 352 44.6952C351.28 45.0252 350.695 45.5502 350.245 46.2702C349.825 46.9902 349.615 47.9652 349.615 49.1952C349.615 50.3952 349.855 51.3852 350.335 52.1652C350.845 52.9752 351.55 53.5752 352.45 53.9652C353.38 54.3552 354.505 54.5502 355.825 54.5502ZM356.41 35.1552C357.34 35.1552 358.075 34.9002 358.615 34.3902C359.155 33.8802 359.545 33.0852 359.785 32.0052C360.025 30.9252 360.145 29.5302 360.145 27.8202C360.145 25.9902 360.025 24.5052 359.785 23.3652C359.545 22.2252 359.14 21.3852 358.57 20.8452C358.03 20.3052 357.295 20.0352 356.365 20.0352C355.465 20.0352 354.73 20.3202 354.16 20.8902C353.62 21.4602 353.215 22.3152 352.945 23.4552C352.705 24.5952 352.585 26.0652 352.585 27.8652C352.585 29.5752 352.705 30.9702 352.945 32.0502C353.215 33.1302 353.635 33.9252 354.205 34.4352C354.775 34.9152 355.51 35.1552 356.41 35.1552Z" fill="#BB9472"/>
<path d="M336.659 44.65C333.329 44.65 330.704 43.615 328.784 41.545C326.864 39.475 325.904 36.325 325.904 32.095C325.904 27.865 326.819 24.73 328.649 22.69C330.479 20.62 333.194 19.585 336.794 19.585C340.124 19.585 342.749 20.62 344.669 22.69C346.589 24.73 347.549 27.865 347.549 32.095C347.549 36.325 346.619 39.475 344.759 41.545C342.929 43.615 340.229 44.65 336.659 44.65ZM336.749 44.2C338.129 44.2 339.239 43.81 340.079 43.03C340.919 42.22 341.519 40.93 341.879 39.16C342.269 37.39 342.464 35.035 342.464 32.095C342.464 29.185 342.269 26.845 341.879 25.075C341.519 23.305 340.919 22.03 340.079 21.25C339.239 20.44 338.114 20.035 336.704 20.035C335.324 20.035 334.214 20.44 333.374 21.25C332.534 22.03 331.919 23.305 331.529 25.075C331.169 26.845 330.989 29.185 330.989 32.095C330.989 35.035 331.169 37.39 331.529 39.16C331.919 40.93 332.534 42.22 333.374 43.03C334.244 43.81 335.369 44.2 336.749 44.2Z" fill="#BB9472"/>
<path d="M322.791 44.6498C320.571 44.6498 318.921 44.1398 317.841 43.1198C316.761 42.0698 316.221 40.2398 316.221 37.6298V20.5298H312.846V20.0798C314.016 20.0798 315.036 19.9748 315.906 19.7648C316.806 19.5248 317.571 19.1648 318.201 18.6848C318.861 18.2048 319.386 17.5898 319.776 16.8398C320.196 16.0598 320.511 15.1298 320.721 14.0498H321.171V20.0798H327.336V20.5298H321.171V39.3848C321.171 40.9148 321.456 42.0548 322.026 42.8048C322.626 43.5548 323.496 43.9298 324.636 43.9298C325.056 43.9298 325.491 43.8848 325.941 43.7948C326.421 43.7048 326.916 43.5698 327.426 43.3898V43.8398C327.036 44.0198 326.406 44.1998 325.536 44.3798C324.666 44.5598 323.751 44.6498 322.791 44.6498Z" fill="#BB9472"/>
<path d="M352.723 10.56C352.518 11.8433 352.108 12.8517 351.493 13.585C350.912 14.3183 350.383 14.8133 349.904 15.07C349.597 15.2533 349.409 15.2533 349.341 15.07C349.307 14.9967 349.307 14.9417 349.341 14.905C349.375 14.8683 349.477 14.7583 349.648 14.575C350.024 14.245 350.4 13.7683 350.775 13.145C351.151 12.485 351.407 11.7883 351.544 11.055C351.749 9.735 351.698 8.47 351.39 7.26C351.083 6.01333 350.468 4.93167 349.546 4.015C348.623 3.06167 347.376 2.31 345.805 1.76C344.268 1.21 342.389 0.934998 340.168 0.934998C338.187 0.934998 336.188 1.265 334.173 1.925C332.191 2.54833 330.21 3.41 328.229 4.51C326.247 5.57333 324.3 6.80167 322.387 8.195C320.474 9.58833 318.629 11.055 316.853 12.595C315.315 13.8783 313.915 15.1067 312.651 16.28C311.387 17.4167 310.157 18.5717 308.961 19.745C307.766 20.9183 306.536 22.1283 305.272 23.375C304.042 24.6217 302.676 25.9967 301.172 27.5C300.113 28.5633 299.054 29.645 297.995 30.745C296.971 31.845 295.997 32.9083 295.075 33.935C294.152 34.9617 293.315 35.915 292.564 36.795C291.812 37.6383 291.214 38.335 290.77 38.885C289.984 39.9483 289.37 40.8467 288.925 41.58C288.515 42.2767 288.498 42.7167 288.874 42.9C289.079 43.01 289.387 42.9733 289.797 42.79C290.241 42.57 290.702 42.295 291.18 41.965C291.693 41.635 292.188 41.2867 292.666 40.92C293.144 40.5533 293.537 40.2417 293.845 39.985C294.665 39.2883 295.467 38.5733 296.253 37.84C297.073 37.07 297.876 36.3183 298.662 35.585C298.764 35.475 298.867 35.3833 298.969 35.31C299.071 35.2367 299.191 35.2917 299.328 35.475C299.43 35.6217 299.43 35.7683 299.328 35.915C299.259 36.025 299.174 36.1167 299.071 36.19C298.662 36.5933 298.235 36.9967 297.79 37.4C297.346 37.8033 296.902 38.2067 296.458 38.61C296.048 38.9767 295.655 39.3433 295.28 39.71C294.904 40.04 294.579 40.315 294.306 40.535C293.93 40.865 293.486 41.2317 292.974 41.635C292.495 42.0017 292 42.35 291.488 42.68C290.975 43.01 290.48 43.285 290.002 43.505C289.557 43.725 289.165 43.835 288.823 43.835C287.935 43.835 287.337 43.45 287.029 42.68C286.756 41.8733 287.081 40.7 288.003 39.16C286.5 40.5167 285.099 41.635 283.801 42.515C282.503 43.395 281.444 43.835 280.624 43.835C279.736 43.835 279.189 43.5233 278.984 42.9C278.779 42.2767 278.831 41.4883 279.138 40.535C279.411 39.5817 279.89 38.555 280.573 37.455C281.222 36.3183 281.991 35.2733 282.879 34.32C283.904 33.22 285.065 32.1933 286.363 31.24C287.661 30.25 288.925 29.425 290.155 28.765C291.419 28.105 292.581 27.6467 293.64 27.39C294.699 27.1333 295.484 27.17 295.997 27.5C296.373 27.6833 296.526 28.0317 296.458 28.545C296.424 29.0583 296.219 29.5717 295.843 30.085C296.834 28.9483 298.115 27.555 299.686 25.905C301.292 24.255 303.017 22.5317 304.862 20.735C306.707 18.9383 308.586 17.1783 310.499 15.455C312.446 13.695 314.274 12.155 315.982 10.835C317.826 9.405 319.739 8.03 321.721 6.71C323.702 5.39 325.718 4.235 327.767 3.245C329.851 2.255 331.952 1.46667 334.07 0.879999C336.188 0.293333 338.323 0 340.476 0C342.935 0 345.002 0.33 346.676 0.99C348.35 1.61333 349.665 2.43833 350.622 3.465C351.612 4.455 352.262 5.57333 352.569 6.82C352.876 8.06667 352.928 9.31333 352.723 10.56ZM295.587 28.16C295.075 27.72 293.896 28.16 292.051 29.48C290.241 30.8 287.969 32.8533 285.236 35.64C284.45 36.4467 283.716 37.2533 283.032 38.06C282.383 38.8667 281.837 39.6183 281.393 40.315C280.949 41.0117 280.675 41.5983 280.573 42.075C280.436 42.5517 280.522 42.8633 280.829 43.01C281.068 43.12 281.495 43.01 282.11 42.68C282.759 42.3133 283.528 41.8 284.416 41.14C285.338 40.4433 286.329 39.6 287.388 38.61C288.447 37.62 289.523 36.52 290.616 35.31C291.129 34.76 291.71 34.1183 292.359 33.385C293.042 32.6517 293.657 31.9367 294.203 31.24C294.784 30.5067 295.211 29.865 295.484 29.315C295.792 28.765 295.826 28.38 295.587 28.16Z" fill="#655346"/>
<path d="M284.108 27.3898C284.518 27.6464 284.74 27.9764 284.774 28.3798C284.809 28.7831 284.706 29.2048 284.467 29.6448C284.228 30.0848 283.886 30.5431 283.442 31.0198C283.032 31.4598 282.588 31.8631 282.11 32.2298C281.7 32.5231 281.17 32.8348 280.521 33.1648C279.906 33.4581 279.274 33.7148 278.625 33.9348C278.01 34.1181 277.413 34.2464 276.832 34.3198C276.285 34.3931 275.892 34.3381 275.653 34.1548C274.867 34.9614 274.082 35.8414 273.296 36.7948C272.51 37.7114 271.844 38.6098 271.298 39.4898C270.785 40.3331 270.461 41.0848 270.324 41.7448C270.153 42.3681 270.307 42.7898 270.785 43.0098C271.263 43.1931 271.964 43.1381 272.886 42.8448C273.808 42.5148 274.799 41.9831 275.858 41.2498C277.088 40.4064 278.301 39.4531 279.496 38.3898C280.692 37.3264 281.649 36.4281 282.366 35.6948C282.469 35.5848 282.588 35.4931 282.725 35.4198C282.896 35.3464 283.015 35.3648 283.083 35.4748C283.186 35.6214 283.186 35.7681 283.083 35.9148C283.015 36.0248 282.93 36.1348 282.827 36.2448C281.939 37.0881 281.017 37.9498 280.06 38.8298C279.104 39.6731 278.062 40.5164 276.934 41.3598C276.046 42.0564 275.021 42.6798 273.86 43.2298C272.732 43.7431 271.673 43.9631 270.683 43.8898C269.999 43.8164 269.419 43.5598 268.94 43.1198C268.462 42.6431 268.274 41.9098 268.377 40.9198C268.377 40.6631 268.445 40.3148 268.582 39.8748C268.684 39.3981 268.889 38.8481 269.197 38.2248C269.47 37.6014 269.863 36.9231 270.375 36.1898C270.888 35.4198 271.554 34.6131 272.374 33.7698C273.33 32.7798 274.389 31.8448 275.551 30.9648C276.746 30.0481 277.891 29.2964 278.984 28.7098C280.111 28.0864 281.136 27.6464 282.059 27.3898C282.981 27.1331 283.664 27.1331 284.108 27.3898ZM283.801 27.8848C283.63 27.7381 283.237 27.8481 282.622 28.2148C282.041 28.5814 281.358 29.0764 280.573 29.6998C279.787 30.2864 278.967 30.9648 278.113 31.7348C277.293 32.4681 276.576 33.1648 275.961 33.8248C276.166 33.8981 276.456 33.8981 276.832 33.8248C277.242 33.7514 277.703 33.6048 278.215 33.3848C278.728 33.1648 279.257 32.8898 279.804 32.5598C280.385 32.1931 280.965 31.7714 281.546 31.2948C282.4 30.5614 283.049 29.8648 283.493 29.2048C283.972 28.5448 284.074 28.1048 283.801 27.8848Z" fill="#655346"/>
<path d="M276.074 29.205C276.04 29.5717 275.921 29.8467 275.716 30.03C275.545 30.2133 275.408 30.2867 275.306 30.25C275.237 30.2133 275.152 30.1583 275.05 30.085C274.947 29.975 274.828 29.8833 274.691 29.81C274.452 29.6633 274.247 29.5717 274.076 29.535C273.939 29.4617 273.7 29.4067 273.359 29.37C272.846 29.3333 272.197 29.5167 271.411 29.92C270.626 30.3233 269.789 30.855 268.9 31.515C268.012 32.175 267.09 32.9267 266.133 33.77C265.177 34.6133 264.271 35.475 263.417 36.355C262.598 37.1983 261.914 37.9133 261.368 38.5C260.855 39.05 260.377 39.6 259.933 40.15C259.523 40.6633 259.096 41.2317 258.652 41.855C258.174 42.4783 257.593 43.2483 256.91 44.165C256.739 44.165 256.619 44.0733 256.551 43.89C256.448 43.7433 256.38 43.56 256.346 43.34C256.312 43.0833 256.312 42.845 256.346 42.625C256.346 42.3683 256.38 42.1667 256.448 42.02C257.132 40.6267 258.071 39.1417 259.267 37.565C260.428 35.9517 261.692 34.375 263.059 32.835C263.879 31.8817 264.699 31.02 265.518 30.25C266.372 29.4433 267.107 28.8383 267.722 28.435C268.132 28.1417 268.661 27.9217 269.31 27.775C269.994 27.5917 270.66 27.5 271.309 27.5C270.25 28.2333 269.054 29.2417 267.722 30.525C266.39 31.7717 265.177 33.0917 264.084 34.485L264.237 34.705C264.955 34.045 265.792 33.275 266.748 32.395C267.705 31.515 268.678 30.7083 269.669 29.975C270.66 29.205 271.616 28.5817 272.539 28.105C273.495 27.6283 274.281 27.445 274.896 27.555C275.34 27.6283 275.647 27.83 275.818 28.16C276.023 28.4533 276.109 28.8017 276.074 29.205Z" fill="#655346"/>
<path d="M262.29 27.3898C262.7 27.6464 262.922 27.9764 262.956 28.3798C262.99 28.7831 262.888 29.2048 262.649 29.6448C262.409 30.0848 262.068 30.5431 261.624 31.0198C261.214 31.4598 260.77 31.8631 260.291 32.2298C259.882 32.5231 259.352 32.8348 258.703 33.1648C258.088 33.4581 257.456 33.7148 256.807 33.9348C256.192 34.1181 255.594 34.2464 255.013 34.3198C254.467 34.3931 254.074 34.3381 253.835 34.1548C253.049 34.9614 252.263 35.8414 251.478 36.7948C250.692 37.7114 250.026 38.6098 249.479 39.4898C248.967 40.3331 248.642 41.0848 248.506 41.7448C248.335 42.3681 248.489 42.7898 248.967 43.0098C249.445 43.1931 250.145 43.1381 251.068 42.8448C251.99 42.5148 252.981 41.9831 254.04 41.2498C255.27 40.4064 256.482 39.4531 257.678 38.3898C258.874 37.3264 259.83 36.4281 260.548 35.6948C260.65 35.5848 260.77 35.4931 260.906 35.4198C261.077 35.3464 261.197 35.3648 261.265 35.4748C261.368 35.6214 261.368 35.7681 261.265 35.9148C261.197 36.0248 261.111 36.1348 261.009 36.2448C260.121 37.0881 259.198 37.9498 258.242 38.8298C257.285 39.6731 256.243 40.5164 255.116 41.3598C254.228 42.0564 253.203 42.6798 252.041 43.2298C250.914 43.7431 249.855 43.9631 248.864 43.8898C248.181 43.8164 247.6 43.5598 247.122 43.1198C246.644 42.6431 246.456 41.9098 246.558 40.9198C246.558 40.6631 246.627 40.3148 246.763 39.8748C246.866 39.3981 247.071 38.8481 247.378 38.2248C247.652 37.6014 248.044 36.9231 248.557 36.1898C249.069 35.4198 249.735 34.6131 250.555 33.7698C251.512 32.7798 252.571 31.8448 253.732 30.9648C254.928 30.0481 256.072 29.2964 257.166 28.7098C258.293 28.0864 259.318 27.6464 260.24 27.3898C261.163 27.1331 261.846 27.1331 262.29 27.3898ZM261.982 27.8848C261.812 27.7381 261.419 27.8481 260.804 28.2148C260.223 28.5814 259.54 29.0764 258.754 29.6998C257.968 30.2864 257.149 30.9648 256.295 31.7348C255.475 32.4681 254.757 33.1648 254.142 33.8248C254.347 33.8981 254.638 33.8981 255.013 33.8248C255.423 33.7514 255.885 33.6048 256.397 33.3848C256.909 33.1648 257.439 32.8898 257.986 32.5598C258.566 32.1931 259.147 31.7714 259.728 31.2948C260.582 30.5614 261.231 29.8648 261.675 29.2048C262.153 28.5448 262.256 28.1048 261.982 27.8848Z" fill="#655346"/>
<path d="M252.497 28.0502C252.395 28.3802 252.224 28.7285 251.985 29.0952C251.746 29.4252 251.524 29.7185 251.319 29.9752C250.772 30.5985 250.208 31.2585 249.628 31.9552C249.047 32.6518 248.432 33.3118 247.783 33.9352C246.656 35.0718 245.648 36.0435 244.76 36.8502C243.906 37.6202 243.137 38.2985 242.454 38.8852C241.805 39.4352 241.224 39.8935 240.711 40.2602C240.233 40.6268 239.823 40.9568 239.482 41.2502C239.072 41.5802 238.628 41.8918 238.149 42.1852C237.671 42.4785 237.176 42.7535 236.663 43.0102C236.185 43.2668 235.707 43.4685 235.229 43.6152C234.784 43.7618 234.374 43.8352 233.999 43.8352C233.145 43.8352 232.564 43.5968 232.256 43.1202C231.949 42.6068 231.881 41.9468 232.051 41.1402C232.188 40.2968 232.564 39.3802 233.179 38.3902C233.76 37.3635 234.528 36.3185 235.485 35.2552C235.963 34.7052 236.544 34.1185 237.227 33.4952C237.944 32.8718 238.73 32.2485 239.584 31.6252C240.438 31.0018 241.326 30.4152 242.249 29.8652C243.205 29.3152 244.162 28.8385 245.118 28.4352C244.025 28.4352 243 28.5268 242.044 28.7102C241.121 28.8935 240.336 29.1135 239.687 29.3702C239.345 29.4802 239.055 29.6268 238.816 29.8102C238.611 29.9935 238.423 30.1585 238.252 30.3052C238.115 30.4518 237.996 30.5435 237.893 30.5802C237.825 30.6168 237.774 30.5802 237.739 30.4702C237.603 30.1768 237.654 29.8285 237.893 29.4252C238.166 28.9852 238.645 28.6368 239.328 28.3802C239.875 28.1968 240.814 28.0135 242.146 27.8302C243.513 27.6468 245.05 27.6652 246.758 27.8852C246.963 27.8852 247.1 27.9402 247.168 28.0502C247.202 28.0868 247.083 28.2152 246.809 28.4352C245.785 29.1685 244.708 30.0302 243.581 31.0202C242.454 31.9735 241.378 32.9452 240.353 33.9352C239.328 34.9252 238.406 35.8602 237.586 36.7402C236.766 37.6202 236.151 38.3352 235.741 38.8852C234.955 39.9485 234.374 40.8468 233.999 41.5802C233.589 42.2768 233.572 42.7168 233.947 42.9002C234.152 43.0102 234.443 43.0102 234.819 42.9002C235.194 42.7902 235.621 42.6252 236.1 42.4052C236.578 42.1485 237.073 41.8552 237.586 41.5252C238.098 41.1952 238.576 40.8652 239.02 40.5352C240.831 39.0685 242.42 37.6568 243.786 36.3002C245.153 34.9435 246.536 33.3852 247.937 31.6252C248.483 30.9652 248.825 30.4335 248.962 30.0302C249.098 29.6268 249.149 29.3152 249.115 29.0952C249.115 28.8385 249.081 28.6368 249.013 28.4902C248.979 28.3435 249.013 28.1968 249.115 28.0502C249.218 27.9035 249.474 27.7568 249.884 27.6102C250.328 27.4268 250.755 27.2985 251.165 27.2252C251.609 27.1518 251.968 27.1702 252.241 27.2802C252.549 27.3535 252.634 27.6102 252.497 28.0502Z" fill="#655346"/>
<path d="M235.085 27.4451C235.87 27.8851 235.939 28.9484 235.29 30.6351C234.675 32.3218 233.274 34.3384 231.088 36.6851C229.96 37.8951 228.867 38.9768 227.808 39.9301C226.783 40.8834 225.81 41.6718 224.887 42.2951C223.965 42.9184 223.128 43.3584 222.376 43.6151C221.659 43.8718 221.061 43.9451 220.583 43.8351C219.797 43.6151 219.285 43.1751 219.046 42.5151C218.806 41.8551 218.806 41.0484 219.046 40.0951C219.251 39.1418 219.678 38.0968 220.327 36.9601C220.976 35.8234 221.813 34.6868 222.838 33.5501C223.897 32.4134 225.024 31.4051 226.22 30.5251C227.415 29.6084 228.577 28.8751 229.704 28.3251C230.866 27.7751 231.907 27.4268 232.83 27.2801C233.786 27.0968 234.538 27.1518 235.085 27.4451ZM234.777 28.1051C234.504 27.8851 234.043 27.9034 233.394 28.1601C232.779 28.4168 232.01 28.8934 231.088 29.5901C230.199 30.2501 229.209 31.0934 228.116 32.1201C227.022 33.1468 225.895 34.3201 224.734 35.6401C223.982 36.4834 223.282 37.3084 222.633 38.1151C222.018 38.8851 221.505 39.6001 221.095 40.2601C220.685 40.9201 220.446 41.5068 220.378 42.0201C220.275 42.4968 220.395 42.8451 220.737 43.0651C221.044 43.2484 221.505 43.1934 222.12 42.9001C222.735 42.5701 223.47 42.0568 224.324 41.3601C225.178 40.6634 226.134 39.8018 227.193 38.7751C228.252 37.7484 229.362 36.5934 230.524 35.3101C231.036 34.7601 231.583 34.1184 232.164 33.3851C232.779 32.6518 233.308 31.9368 233.752 31.2401C234.231 30.5068 234.572 29.8651 234.777 29.3151C235.016 28.7284 235.016 28.3251 234.777 28.1051Z" fill="#655346"/>
<path d="M222.907 30.5798C222.668 31.0931 222.378 31.5881 222.036 32.0648C221.729 32.5415 221.336 32.9815 220.858 33.3848C220.618 33.6048 220.294 33.8248 219.884 34.0448C219.474 34.2648 219.132 34.2098 218.859 33.8798C218.722 33.6965 218.688 33.4948 218.757 33.2748C218.825 33.0548 218.944 32.8348 219.115 32.6148C219.32 32.3948 219.542 32.1931 219.781 32.0098C220.021 31.8265 220.243 31.6615 220.448 31.5148C221.541 30.7815 222.224 30.0848 222.497 29.4248C222.805 28.7648 222.771 28.3065 222.395 28.0498C222.156 27.8665 221.694 27.9765 221.011 28.3798C220.362 28.7831 219.628 29.3331 218.808 30.0298C217.988 30.7265 217.134 31.4965 216.246 32.3398C215.357 33.1831 214.589 33.9531 213.94 34.6498C211.685 36.9598 210.233 38.8298 209.584 40.2598C208.935 41.6898 208.901 42.5881 209.482 42.9548C209.789 43.1381 210.199 43.1748 210.711 43.0648C211.224 42.9548 211.753 42.7898 212.3 42.5698C212.847 42.3131 213.376 42.0198 213.889 41.6898C214.435 41.3598 214.862 41.0848 215.17 40.8648C215.648 40.5348 216.16 40.1315 216.707 39.6548C217.288 39.1781 217.851 38.7015 218.398 38.2248C218.979 37.7481 219.508 37.2715 219.986 36.7948C220.499 36.3181 220.943 35.9148 221.319 35.5848C221.592 35.3648 221.797 35.3281 221.934 35.4748C222.139 35.6215 222.104 35.8048 221.831 36.0248C221.148 36.7581 220.294 37.5648 219.269 38.4448C218.278 39.3248 217.339 40.1315 216.451 40.8648C215.562 41.5615 214.589 42.2031 213.53 42.7898C212.505 43.3765 211.429 43.7431 210.302 43.8898C209.311 43.9998 208.542 43.7981 207.996 43.2848C207.415 42.7715 207.142 42.0931 207.176 41.2498C207.176 40.0031 207.586 38.7015 208.406 37.3448C209.191 35.9881 210.233 34.6681 211.531 33.3848C212.522 32.3948 213.581 31.4781 214.708 30.6348C215.87 29.7915 216.963 29.0948 217.988 28.5448C219.047 27.9948 220.003 27.6281 220.858 27.4448C221.712 27.2248 222.361 27.2431 222.805 27.4998C223.078 27.6831 223.249 27.9031 223.317 28.1598C223.385 28.4165 223.403 28.7098 223.368 29.0398C223.334 29.3331 223.266 29.6265 223.163 29.9198C223.061 30.1765 222.976 30.3965 222.907 30.5798Z" fill="#655346"/>
<path d="M213.844 23.155C214.049 23.3384 213.963 23.7417 213.588 24.365C213.212 24.9884 212.46 25.7217 211.333 26.565C210.718 27.0417 210.069 27.5184 209.386 27.995C208.737 28.435 208.224 28.8567 207.848 29.26C207.575 29.6267 207.353 30.085 207.182 30.635C207.046 31.1484 206.943 31.625 206.875 32.065C206.772 32.6884 206.653 33.4217 206.516 34.265C206.414 35.0717 206.192 35.9334 205.85 36.85C205.508 37.7667 205.013 38.6834 204.364 39.6C203.749 40.5167 202.878 41.3784 201.751 42.185C203.424 41.3417 205.03 40.315 206.567 39.105C208.139 37.895 209.522 36.7217 210.718 35.585C210.889 35.4017 211.06 35.4017 211.23 35.585C211.333 35.6584 211.35 35.7684 211.282 35.915C211.213 36.0617 211.145 36.1717 211.077 36.245C210.325 36.9784 209.539 37.675 208.72 38.335C207.9 38.995 207.097 39.6184 206.311 40.205C205.525 40.755 204.757 41.25 204.005 41.69C203.288 42.13 202.656 42.4784 202.109 42.735C201.665 42.955 201.187 43.1567 200.674 43.34C200.162 43.4867 199.65 43.5967 199.137 43.67C198.659 43.78 198.215 43.8534 197.805 43.89C197.361 43.9267 197.019 43.9267 196.78 43.89C196.097 43.8534 195.516 43.6884 195.038 43.395C194.559 43.065 194.337 42.5334 194.372 41.8C194.372 41.36 194.542 40.865 194.884 40.315C195.191 39.7284 195.636 39.16 196.216 38.61C196.455 38.4267 196.814 38.1334 197.292 37.73C197.737 37.29 198.112 36.9234 198.42 36.63C198.898 36.19 199.325 35.8234 199.701 35.53C200.111 35.2 200.487 35.035 200.828 35.035C201.341 34.5584 201.887 34.0634 202.468 33.55C203.049 33 203.612 32.45 204.159 31.9C204.706 31.35 205.218 30.8367 205.696 30.36C206.209 29.8467 206.619 29.3884 206.926 28.985C207.541 28.1784 208.105 27.4817 208.617 26.895C209.13 26.2717 209.693 25.6667 210.308 25.08C211.196 24.2 211.931 23.595 212.512 23.265C213.092 22.8984 213.536 22.8617 213.844 23.155ZM206.619 30.195C205.935 31.0384 205.098 31.9184 204.108 32.835C203.151 33.7517 202.16 34.6684 201.136 35.585C200.965 36.1717 200.196 36.9234 198.83 37.84C198.522 38.0967 198.112 38.4084 197.6 38.775C197.087 39.105 196.643 39.4167 196.268 39.71C195.516 40.3334 195.106 40.975 195.038 41.635C195.004 42.0384 195.14 42.3317 195.448 42.515C195.721 42.6617 196.011 42.735 196.319 42.735C197.105 42.735 198.01 42.4417 199.035 41.855C200.06 41.2684 201.067 40.37 202.058 39.16C202.502 38.6467 202.963 38.005 203.442 37.235C203.92 36.465 204.364 35.6767 204.774 34.87C205.184 34.0267 205.543 33.2017 205.85 32.395C206.192 31.5517 206.448 30.8184 206.619 30.195Z" fill="#655346"/>
<path d="M205.752 22.935C205.752 23.3384 205.598 23.705 205.29 24.035C205.017 24.3284 204.693 24.475 204.317 24.475C203.941 24.475 203.599 24.3284 203.292 24.035C203.019 23.705 202.882 23.3384 202.882 22.935C202.882 22.5317 203.019 22.1834 203.292 21.89C203.599 21.56 203.941 21.395 204.317 21.395C204.693 21.395 205.017 21.56 205.29 21.89C205.598 22.1834 205.752 22.5317 205.752 22.935ZM201.806 27.5C200.713 28.5634 199.62 29.645 198.526 30.745C197.467 31.845 196.46 32.9084 195.503 33.935C194.547 34.9617 193.692 35.915 192.941 36.795C192.189 37.6384 191.592 38.335 191.147 38.885C190.362 39.9484 189.781 40.865 189.405 41.635C188.995 42.3684 188.978 42.8267 189.354 43.01C189.559 43.12 189.866 43.1017 190.276 42.955C190.686 42.8084 191.113 42.6067 191.557 42.35C192.036 42.0567 192.514 41.745 192.992 41.415C193.47 41.085 193.897 40.7734 194.273 40.48C194.717 40.15 195.196 39.765 195.708 39.325C196.22 38.885 196.716 38.445 197.194 38.005C197.706 37.565 198.168 37.1434 198.578 36.74C199.022 36.3367 199.38 36.0067 199.654 35.75C199.756 35.6767 199.859 35.6034 199.961 35.53C200.098 35.42 200.234 35.4384 200.371 35.585C200.474 35.695 200.491 35.805 200.422 35.915C200.354 36.025 200.269 36.1167 200.166 36.19C199.825 36.5567 199.398 36.9784 198.885 37.455C198.407 37.9317 197.894 38.4084 197.348 38.885C196.835 39.325 196.34 39.7467 195.862 40.15C195.383 40.5534 195.008 40.865 194.734 41.085C193.88 41.745 192.941 42.3867 191.916 43.01C190.891 43.5967 190.003 43.89 189.251 43.89C188.397 43.89 187.834 43.6517 187.56 43.175C187.287 42.6617 187.253 42.02 187.458 41.25C187.663 40.4434 188.09 39.5267 188.739 38.5C189.354 37.4734 190.14 36.41 191.096 35.31C191.609 34.76 192.206 34.1367 192.89 33.44C193.573 32.7067 194.273 31.9917 194.991 31.295C195.742 30.5984 196.46 29.9567 197.143 29.37C197.86 28.7834 198.475 28.3434 198.988 28.05C199.363 27.83 199.842 27.6834 200.422 27.61C201.003 27.5 201.464 27.4634 201.806 27.5Z" fill="#655346"/>
<path d="M193.757 7.80977C193.723 7.95643 193.569 8.02977 193.296 8.02977C193.022 8.02977 192.612 8.1031 192.066 8.24977C191.178 8.46977 190.221 8.90977 189.196 9.56977C188.205 10.2298 187.403 10.8714 186.788 11.4948C187.813 12.4848 188.65 13.5848 189.299 14.7948C189.982 16.0048 190.494 17.2331 190.836 18.4798C191.212 19.7264 191.434 20.9548 191.502 22.1648C191.57 23.3381 191.519 24.4014 191.348 25.3548C191.007 27.1881 190.546 28.8198 189.965 30.2498C189.384 31.6431 188.718 32.9081 187.966 34.0448C187.215 35.1448 186.412 36.1348 185.558 37.0148C184.704 37.8948 183.85 38.7198 182.996 39.4898C181.014 41.1031 178.504 42.4231 175.463 43.4498C172.423 44.5131 168.836 44.9898 164.702 44.8798C163.028 44.8431 161.371 44.7331 159.732 44.5498C158.126 44.3664 156.555 44.1648 155.017 43.9448C153.514 43.7248 152.079 43.5048 150.713 43.2848C149.381 43.0648 148.168 42.8998 147.075 42.7898C148.065 45.4298 149.671 47.4648 151.891 48.8948C154.112 50.3614 156.93 51.0948 160.346 51.0948C161.474 51.0948 162.533 50.9114 163.524 50.5448C164.548 50.1781 165.351 49.7931 165.932 49.3898C166.103 49.2431 166.274 49.0964 166.444 48.9498C166.615 48.8031 166.735 48.7664 166.803 48.8398C166.974 48.9864 166.991 49.1331 166.854 49.2798C166.752 49.4631 166.615 49.6281 166.444 49.7748C166.171 50.0314 165.812 50.2698 165.368 50.4898C164.924 50.7464 164.412 50.9664 163.831 51.1498C163.284 51.3698 162.687 51.5348 162.037 51.6448C161.388 51.7548 160.739 51.8098 160.09 51.8098C156.572 51.8098 153.651 51.0214 151.328 49.4448C149.005 47.9048 147.314 45.7781 146.255 43.0648C145.845 43.2114 145.23 43.3948 144.41 43.6148C143.59 43.8348 142.753 43.9814 141.899 44.0548C141.387 44.1281 140.908 44.0731 140.464 43.8898C140.02 43.7064 139.815 43.4681 139.849 43.1748C139.849 42.6248 140.174 42.2214 140.823 41.9648C141.438 41.7081 142.053 41.5431 142.668 41.4698C143.214 41.3964 143.778 41.3964 144.359 41.4698C144.939 41.5064 145.418 41.5614 145.794 41.6348C145.247 39.7648 144.974 37.6564 144.974 35.3098C144.974 31.3131 145.794 27.5731 147.433 24.0898C149.107 20.6064 151.481 17.5264 154.556 14.8498C157.084 12.6498 159.988 10.8348 163.267 9.40477C166.547 7.97477 170.117 7.25977 173.977 7.25977C175.514 7.25977 176.881 7.35143 178.076 7.53477C179.306 7.7181 180.399 7.97477 181.356 8.30476C182.313 8.63476 183.167 9.01977 183.918 9.45977C184.67 9.8631 185.353 10.3031 185.968 10.7798C186.275 10.5231 186.651 10.2481 187.095 9.95477C187.573 9.62477 188.069 9.3131 188.581 9.01977C189.094 8.68977 189.623 8.41477 190.17 8.19477C190.716 7.97477 191.229 7.80977 191.707 7.69977C192.185 7.62643 192.647 7.58977 193.091 7.58977C193.569 7.5531 193.791 7.62643 193.757 7.80977ZM189.145 24.3098C189.384 22.9531 189.469 21.6698 189.401 20.4598C189.333 19.2131 189.145 18.0764 188.837 17.0498C188.564 15.9864 188.188 15.0331 187.71 14.1898C187.232 13.3464 186.719 12.6131 186.173 11.9898C184.772 13.2731 183.474 14.5931 182.278 15.9498C181.083 17.3064 179.955 18.6631 178.896 20.0198C177.872 21.3764 176.898 22.6781 175.976 23.9248C175.053 25.1714 174.182 26.2898 173.362 27.2798C170.868 30.2864 168.511 32.7431 166.291 34.6498C164.104 36.5198 162.037 38.0048 160.09 39.1048C158.143 40.2048 156.298 40.9748 154.556 41.4148C152.814 41.8548 151.174 42.1298 149.637 42.2398C150.559 42.4598 151.635 42.6798 152.865 42.8998C154.129 43.0831 155.427 43.2664 156.759 43.4498C158.126 43.5964 159.492 43.7064 160.859 43.7798C162.225 43.8898 163.524 43.9448 164.753 43.9448C167.042 43.9448 169.092 43.7248 170.902 43.2848C172.713 42.8081 174.319 42.2398 175.719 41.5798C177.12 40.8831 178.316 40.1498 179.306 39.3798C180.297 38.5731 181.134 37.8398 181.817 37.1798C182.569 36.4098 183.337 35.5481 184.123 34.5948C184.909 33.6048 185.626 32.5598 186.275 31.4598C186.959 30.3231 187.556 29.1498 188.069 27.9398C188.581 26.7298 188.94 25.5198 189.145 24.3098ZM185.353 11.2748C184.362 10.4314 183.03 9.71643 181.356 9.12977C179.682 8.50643 177.564 8.19477 175.002 8.19477C173.055 8.19477 171.159 8.4331 169.314 8.90977C167.469 9.34977 165.727 9.95477 164.087 10.7248C162.447 11.4581 160.927 12.3014 159.527 13.2548C158.126 14.2081 156.879 15.1798 155.786 16.1698C154.351 17.4531 153.019 18.8464 151.789 20.3498C150.593 21.8164 149.551 23.3748 148.663 25.0248C147.809 26.6748 147.143 28.3981 146.665 30.1948C146.186 31.9914 145.947 33.8431 145.947 35.7498C145.947 38.0231 146.221 40.0214 146.767 41.7448C148.885 41.6714 150.867 41.3598 152.711 40.8098C154.556 40.2231 156.367 39.3614 158.143 38.2248C159.954 37.0514 161.798 35.5481 163.677 33.7148C165.556 31.8814 167.623 29.6631 169.878 27.0598C171.142 25.5931 172.423 24.1264 173.721 22.6598C175.053 21.1931 176.368 19.7814 177.667 18.4248C178.965 17.0314 180.263 15.7298 181.561 14.5198C182.859 13.3098 184.123 12.2281 185.353 11.2748Z" fill="#655346"/>
</svg> */}

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
