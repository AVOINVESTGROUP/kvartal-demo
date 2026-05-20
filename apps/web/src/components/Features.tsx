export const Features = () => {
  const features = [
    { num: "01", title: "Экспертиза в ЦАО", text: "Глубокое знание рынка особняков и исторических зданий в центре Москвы." },
    { num: "02", title: "Офф-маркет", text: "Доступ к объектам, которые не представлены на открытых площадках." },
    { num: "03", title: "Полный цикл", text: "От подбора и технического аудита до юридического сопровождения сделки." },
    { num: "04", title: "Конфиденциальность", text: "Гарантируем приватность переговоров и защиту интересов клиента." },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-kv-container mx-auto px-5">
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5 text-kv-red text-[13px] font-black uppercase tracking-widest before:content-[''] before:w-[30px] before:h-[2px] before:bg-current">
              Преимущества
            </div>
            <h2 className="text-kv-navy text-3xl md:text-5xl font-black leading-[1.08] tracking-tight max-w-[760px]">
              Почему выбирают Kvartal для работы с недвижимостью
            </h2>
          </div>
          <p className="max-w-[460px] text-kv-muted leading-relaxed">
            Мы специализируемся на сложных сделках с коммерческой недвижимостью, где важны детали и профессиональный подход.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {features.map((f, i) => (
            <div key={i} className="min-h-[230px] p-6.5 border border-kv-line rounded-kv-main bg-white shadow-sm hover:shadow-xl transition-shadow">
              <div className="inline-grid place-items-center w-10.5 h-10.5 mb-4.5 rounded-full text-white bg-kv-navy font-black text-sm">
                {f.num}
              </div>
              <h3 className="text-kv-navy text-xl font-bold mb-2.5 leading-tight">{f.title}</h3>
              <p className="text-kv-muted text-[15px] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
