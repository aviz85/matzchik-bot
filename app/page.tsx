import ChatBot from './components/ChatBot';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🤖 מצ'יק בוט
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            הבוט הכי מתלהב ומעצבן בעולם! מוכן לדבר איתך על הכל!
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            💡 הבוט יכול לשנות את מצב הרוח שלו במהלך השיחה - תראה את השינויים בפאנל הימני
          </p>
        </div>
        
        <ChatBot />
        
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>מופעל על ידי Google Gemini AI</p>
        </div>
      </div>
    </div>
  );
}
