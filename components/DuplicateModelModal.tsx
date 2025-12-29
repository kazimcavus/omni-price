import React from 'react';

interface DuplicateModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: () => void;
  onKeepBoth: () => void;
  modelCode: string;
}

export const DuplicateModelModal: React.FC<DuplicateModelModalProps> = ({
  isOpen,
  onClose,
  onReplace,
  onKeepBoth,
  modelCode
}) => {
  if (!isOpen) return null;

  const handleReplace = () => {
    onReplace();
    onClose();
  };

  const handleKeepBoth = () => {
    onKeepBoth();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-fade-in" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Modal panel */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg animate-fade-in-up">
          <div className="bg-white px-5 pb-4 pt-6 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 sm:mx-0 sm:h-11 sm:w-11">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 className="text-lg font-semibold leading-6 text-slate-900" id="modal-title">
                  Model Kodu Zaten Mevcut
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-900">"{modelCode}"</span> model kodu listede zaten mevcut. Ne yapmak istersiniz?
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-50/80 px-5 py-4 sm:flex sm:flex-col sm:gap-2.5 sm:px-6">
            <button
              type="button"
              onClick={handleReplace}
              className="inline-flex w-full justify-center items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Eski Kaydı Sil, Yenisini Kaydet
            </button>
            <button
              type="button"
              onClick={handleKeepBoth}
              className="inline-flex w-full justify-center items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              İkisini de Tut
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

